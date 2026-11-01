import { Link } from 'react-router-dom';
import ClubLogo from './ClubLogo.jsx';
import { formatDay } from '../lib/dates.js';

function Side({ side, winner }) {
  return (
    <div className={`game-card__side${winner ? ' game-card__side--winner' : ''}`}>
      <ClubLogo side={side} />
      <span className="game-card__club">{side.name}</span>
      <span className="game-card__score">{side.score ?? ''}</span>
    </div>
  );
}

export default function GameCard({ game, link = true }) {
  const { home, away, played } = game;
  const homeWins = played && home.score > away.score;
  const awayWins = played && away.score > home.score;

  const content = (
    <>
      <div className="game-card__meta">
        <span>{formatDay(game.date)}{game.time ? ` · ${game.time}` : ''}</span>
        {game.category && <span className="game-card__category">{game.category}</span>}
      </div>
      <Side side={home} winner={homeWins} />
      <Side side={away} winner={awayWins} />
    </>
  );

  return link
    ? <Link className="game-card" to={`/partido/${game.slug}`}>{content}</Link>
    : <div className="game-card">{content}</div>;
}
