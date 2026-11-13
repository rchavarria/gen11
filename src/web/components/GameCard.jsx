import { Link } from 'react-router-dom';
import clubs from '../../data/clubs.json';
import venues from '../../data/venues.json';
import { formatDay, gameDay, gameTime } from '../lib/dates.js';
import { isHighlighted } from '../lib/game.js';
import ClubLogo from './ClubLogo.jsx';

const clubsBySlug = new Map(clubs.map((club) => [club.slug, club]));
const venuesBySlug = new Map(venues.map((venue) => [venue.slug, venue]));

function Side({ side, winner }) {
  const club = clubsBySlug.get(side.club);
  if (!club) throw new Error(`Club no encontrado: ${side.club}`);

  return (
    <div className={`game-card__side${winner ? ' game-card__side--winner' : ''}`}>
      <ClubLogo club={club} />
      <span className="game-card__club">{club.name}</span>
      {side.score != null && <span className="game-card__score">{side.score}</span>}
    </div>
  );
}

export default function GameCard({ game }) {
  const { home, away, played } = game;
  const className = `game-card${isHighlighted(game) ? ' game-card--highlighted' : ''}`;
  const hasScore = home.score != null && away.score != null;
  const venue = !hasScore && venuesBySlug.get(game.venue);
  const homeWins = played && home.score > away.score;
  const awayWins = played && away.score > home.score;
  const time = gameTime(game.date);

  const meta = (
    <div className={`game-card__meta${venue ? ' game-card__meta--with-venue' : ''}`}>
      {!venue && (
        <span>
          {formatDay(gameDay(game.date))}
          {time ? ` · ${time}` : ''}
        </span>
      )}
      {game.category && <span className="game-card__category">{game.category}</span>}
    </div>
  );

  const content = (
    <>
      {!venue && meta}
      <div className={`game-card__body${venue ? ' game-card__body--with-venue' : ''}`}>
        {venue && (
          <div className="game-card__venue" title={[venue.name, venue.address].filter(Boolean).join(' — ')}>
            <span>{formatDay(gameDay(game.date))}</span>
            {time && <strong>{time}</strong>}
            <span>{venue.name}</span>
          </div>
        )}
        <div className="game-card__clubs">
          {venue && meta}
          <Side side={home} winner={homeWins} />
          <Side side={away} winner={awayWins} />
        </div>
      </div>
    </>
  );

  return hasScore ? (
    <Link className={className} to={`/game/${game.slug}`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
