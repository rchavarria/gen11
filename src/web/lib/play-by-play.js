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

export const ACTION_LABELS = { ...BASKET_LABELS, ...FOUL_LABELS };

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

/** Keeps made baskets only, in the original order (most recent first). */
export function getMadeBaskets(playByPlay) {
  if (!Array.isArray(playByPlay)) return [];
  return playByPlay.filter((action) => Object.hasOwn(BASKET_LABELS, action.type));
}

/**
 * Made baskets, fouls and period start/end marks, in the original order.
 * A mark repeated right after itself (some games have two "end of Q4") is dropped.
 */
export function getTimeline(playByPlay) {
  if (!Array.isArray(playByPlay)) return [];
  const timeline = [];
  for (const action of playByPlay) {
    if (!Object.hasOwn(ACTION_LABELS, action.type) && !isPeriodMark(action)) continue;
    const previous = timeline.at(-1);
    if (isPeriodMark(action) && previous?.type === action.type && previous.quarter === action.quarter) continue;
    timeline.push(action);
  }
  return timeline;
}

/** "00:01:12.0" -> "1:12" (remaining time in the period) */
export function formatClock(clock) {
  const match = /^(\d+):(\d+):(\d+)/.exec(clock ?? '');
  if (!match) return '';
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return `${minutes}:${match[3]}`;
}
