export const BASKET_LABELS = {
  'free-throw-made': 'Tiro libre',
  'two-point-made': 'Canasta de 2',
  'three-point-made': 'Triple',
};

export const FOUL_LABELS = {
  'foul-committed': 'Falta personal',
  'technical-foul': 'Técnica',
  'unsportsmanlike-foul': 'Antideportiva',
  'disqualifying-foul': 'Descalificante',
  'coach-technical-foul': 'Técnica al entrenador',
  'bench-technical-foul': 'Técnica al banquillo',
  'disruptive-foul': 'Disruptiva',
  'flagrant-foul': 'Flagrante',
};

export const REBOUND_LABELS = {
  'defensive-rebound': 'Rebote defensivo',
  'offensive-rebound': 'Rebote ofensivo',
};

export const BLOCK_LABELS = {
  'block-made': 'Tapón puesto',
  'block-received': 'Tapón recibido',
};

export const STEAL_LABELS = {
  steal: 'Robo',
  turnover: 'Pérdida',
};

export const MISSED_LABELS = {
  'free-throw-missed': 'Tiro libre fallado',
  'two-point-missed': 'Canasta de 2 fallada',
  'three-point-missed': 'Triple fallado',
};

export const OTHER_LABELS = {
  timeout: 'Tiempo muerto',
  assist: 'Asistencia',
};

export const ACTION_LABELS = {
  ...BASKET_LABELS,
  ...FOUL_LABELS,
  ...REBOUND_LABELS,
  ...BLOCK_LABELS,
  ...STEAL_LABELS,
  ...MISSED_LABELS,
  ...OTHER_LABELS,
};

export function isMissedShot(action) {
  return Object.hasOwn(MISSED_LABELS, action.type);
}

export function isRebound(action) {
  return Object.hasOwn(REBOUND_LABELS, action.type);
}

export function isBlock(action) {
  return action.type === 'block' || Object.hasOwn(BLOCK_LABELS, action.type);
}

/**
 * Actions that come in pairs, one right after the other, by opposite teams:
 * `first` then `second` in the JSON. `main` is the type whose team owns the card.
 */
const PAIRS = [
  { type: 'block', first: 'block-received', second: 'block-made', main: 'block-made' },
  { type: 'steal-turnover', first: 'steal', second: 'turnover', main: 'steal' },
];

function pairOf(previous, action) {
  if (!previous || previous.team === action.team || previous.quarter !== action.quarter) return null;
  const pair = PAIRS.find(({ first, second }) => previous.type === first && action.type === second);
  if (!pair) return null;
  const main = action.type === pair.main ? action : previous;
  const other = main === action ? previous : action;
  return { id: previous.id, type: pair.type, quarter: action.quarter, team: main.team, actions: [main, other] };
}

export function isFoul(action) {
  return Object.hasOwn(FOUL_LABELS, action.type);
}

const PERIOD_MARKS = { 'period-start': 'Inicio', 'period-end': 'Fin' };

export function isPeriodMark(action) {
  return Object.hasOwn(PERIOD_MARKS, action.type);
}

/** "Inicio de cuarto Q2", "Fin de prórroga OT1" */
export function periodMarkLabel({ type, quarter }) {
  const period = quarter > 4 ? `prórroga OT${quarter - 4}` : `cuarto Q${quarter}`;
  return `${PERIOD_MARKS[type]} de ${period}`;
}

const SUBSTITUTIONS = { 'substitution-in': 'in', 'substitution-out': 'out' };

export function isSubstitution(action) {
  return action.type === 'substitution' || action.type === 'lineup';
}

function isPeriodStartClock({ quarter, clock }) {
  return formatClock(clock) === (quarter > 4 ? '5:00' : '10:00');
}

/** Players going in with nobody going out at the period start: the lineup. */
function classifySubstitution(group) {
  return group.out.length === 0 && isPeriodStartClock(group) ? { ...group, type: 'lineup' } : group;
}

/** Keeps made baskets only, in the original order (most recent first). */
export function getMadeBaskets(playByPlay) {
  if (!Array.isArray(playByPlay)) return [];
  return playByPlay.filter((action) => Object.hasOwn(BASKET_LABELS, action.type));
}

/**
 * Made baskets, assists, fouls, rebounds, blocks, timeouts, substitutions and period start/end marks, in the original order.
 * A mark repeated right after itself (some games have two "end of Q4") is dropped.
 * Consecutive substitutions of the same team at the same moment become a single
 * `substitution` item (`in` and `out` jerseys), or `lineup` at the period start.
 * Paired actions (block received + block made, steal + turnover) become a single item
 * (`block`, `steal-turnover`) with `actions: [main, other]`, owned by the main action's team.
 */
export function getTimeline(playByPlay) {
  if (!Array.isArray(playByPlay)) return [];
  const timeline = [];
  for (const action of playByPlay) {
    const previous = timeline.at(-1);
    const direction = SUBSTITUTIONS[action.type];
    if (direction) {
      const sameMoment =
        previous?.type === 'substitution' &&
        previous.team === action.team &&
        previous.quarter === action.quarter &&
        previous.clock === action.clock;
      const group = sameMoment
        ? previous
        : {
            id: action.id,
            type: 'substitution',
            quarter: action.quarter,
            clock: action.clock,
            team: action.team,
            in: [],
            out: [],
          };
      if (!sameMoment) timeline.push(group);
      group[direction].push(action.jersey);
      continue;
    }
    if (!Object.hasOwn(ACTION_LABELS, action.type) && !isPeriodMark(action)) continue;
    if (isPeriodMark(action) && previous?.type === action.type && previous.quarter === action.quarter) continue;
    const pair = pairOf(previous, action);
    if (pair) {
      timeline[timeline.length - 1] = pair;
      continue;
    }
    timeline.push(action);
  }
  return timeline.map((item) => (item.type === 'substitution' ? classifySubstitution(item) : item));
}

/** "Entra #7 #11 · Sale #4 #9", "Quinteto: #7 #11 #15 #20 #X" */
export function substitutionText(item) {
  const jerseys = (list) => list.map((jersey) => `#${jersey}`).join(' ');
  if (item.type === 'lineup') return `Quinteto: ${jerseys(item.in)}`;
  return [item.in.length > 0 && `Entra ${jerseys(item.in)}`, item.out.length > 0 && `Sale ${jerseys(item.out)}`]
    .filter(Boolean)
    .join(' · ');
}

/** "00:01:12.0" -> "1:12" (remaining time in the period) */
export function formatClock(clock) {
  const match = /^(\d+):(\d+):(\d+)/.exec(clock ?? '');
  if (!match) return '';
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return `${minutes}:${match[3]}`;
}
