import { periodLabel } from '../lib/game.js';
import { BASKET_LABELS, formatClock, getMadeBaskets } from '../lib/play-by-play.js';

export default function PlayByPlay({ playByPlay, homeName, awayName }) {
  const baskets = getMadeBaskets(playByPlay);
  if (baskets.length === 0) return <p className="tabs__placeholder">Jugada a jugada no disponible.</p>;

  return (
    <ol className="play-by-play" aria-label="Canastas del partido">
      {baskets.map((action) => {
        const side = action.team === 'away' ? 'away' : 'home';
        const parts = [
          ['period', periodLabel(action.quarter - 1)],
          ['clock', formatClock(action.clock)],
          ['action', BASKET_LABELS[action.type]],
          ['jersey', action.jersey && `#${action.jersey}`],
        ].filter(([, text]) => text);
        if (side === 'away') parts.reverse();
        const info = parts.map(([name, text]) => (
          <span key={name} className={`play-by-play__${name}`}>
            {text}
          </span>
        ));
        return (
          <li
            key={action.id}
            className={`play-by-play__card play-by-play__card--${side}`}
            aria-label={side === 'away' ? awayName : homeName}
          >
            <span className="play-by-play__team play-by-play__team--home">{side === 'home' && info}</span>
            <span className="play-by-play__score">
              {action.homeScore}–{action.awayScore}
            </span>
            <span className="play-by-play__team play-by-play__team--away">{side === 'away' && info}</span>
          </li>
        );
      })}
    </ol>
  );
}
