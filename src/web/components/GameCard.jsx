import { Link } from 'react-router-dom';
import ClubLogo from './ClubLogo.jsx';
import { formatDay } from '../lib/dates.js';
import { isHighlighted } from '../lib/game.js';
import clubs from '../../data/clubs.json';

const clubsBySlug = new Map(clubs.map((club) => [club.slug, club]));

function Side({ side, winner }) {
  const club = clubsBySlug.get(side.club);
  if (!club) throw new Error(`Club no encontrado: ${side.club}`);

  return (
    <div className={`game-card__side${winner ? ' game-card__side--winner' : ''}`}>
      <ClubLogo club={club} />
      <span className="game-card__club">{club.name}</span>
      <span className="game-card__score">{side.score ?? ''}</span>
    </div>
  );
}

export default function GameCard({ game }) {
  const { home, away, played } = game;
  const className = `game-card${isHighlighted(game) ? ' game-card--highlighted' : ''}`;
  const hasScore = home.score != null && away.score != null;
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

  return hasScore
    ? <Link className={className} to={`/game/${game.slug}`}>{content}</Link>
    : <div className={className}>{content}</div>;
}
