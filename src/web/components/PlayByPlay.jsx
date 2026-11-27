import { periodLabel } from '../lib/game.js';
import {
  ACTION_LABELS,
  formatClock,
  getMadeBaskets,
  getTimeline,
  isFoul,
  isPeriodMark,
  isRebound,
  isSubstitution,
  periodMarkLabel,
  substitutionText,
} from '../lib/play-by-play.js';

/** Actions by the coach or the bench: the jersey adds nothing. */
const NO_JERSEY = new Set(['coach-technical-foul', 'bench-technical-foul', 'timeout']);

function centerIcon(item) {
  if (isFoul(item)) return ['✋', 'Falta'];
  if (isRebound(item)) return ['🙌', 'Rebote'];
  if (item.type === 'timeout') return ['⏱️', 'Tiempo muerto'];
  if (item.type === 'assist') return ['🤝', 'Asistencia'];
  if (item.type === 'substitution') return ['🔄', 'Cambio'];
  if (item.type === 'lineup') return ['🔄', 'Quinteto'];
  return null;
}

export default function PlayByPlay({ playByPlay, homeName, awayName }) {
  if (getMadeBaskets(playByPlay).length === 0) {
    return <p className="tabs__placeholder">Jugada a jugada no disponible.</p>;
  }

  return (
    <ol className="play-by-play" aria-label="Jugada a jugada">
      {getTimeline(playByPlay).map((action) => {
        if (isPeriodMark(action)) {
          return (
            <li key={action.id} className={`play-by-play__mark play-by-play__mark--${action.type}`}>
              <span>{periodMarkLabel(action)}</span>
            </li>
          );
        }
        const side = action.team === 'away' ? 'away' : 'home';
        const substitution = isSubstitution(action);
        const parts = [
          ['period', periodLabel(action.quarter - 1)],
          ['clock', formatClock(action.clock)],
          ['action', substitution ? substitutionText(action) : ACTION_LABELS[action.type]],
          ['jersey', !substitution && !NO_JERSEY.has(action.type) && action.jersey && `#${action.jersey}`],
        ].filter(([, text]) => text);
        if (side === 'away') parts.reverse();
        const info = parts.map(([name, text]) => (
          <span key={name} className={`play-by-play__${name}`}>
            {text}
          </span>
        ));
        const icon = centerIcon(action);
        return (
          <li
            key={action.id}
            className={`play-by-play__card play-by-play__card--${side}`}
            aria-label={side === 'away' ? awayName : homeName}
          >
            <span className="play-by-play__team play-by-play__team--home">{side === 'home' && info}</span>
            {icon ? (
              <span className="play-by-play__score play-by-play__score--icon" role="img" aria-label={icon[1]}>
                {icon[0]}
              </span>
            ) : (
              <span className="play-by-play__score">
                {action.homeScore}–{action.awayScore}
              </span>
            )}
            <span className="play-by-play__team play-by-play__team--away">{side === 'away' && info}</span>
          </li>
        );
      })}
    </ol>
  );
}
