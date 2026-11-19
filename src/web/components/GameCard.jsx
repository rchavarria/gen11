import { Link } from 'react-router-dom';
import teams from '../../data/teams.json';
import { formatDay, gameDay, gameTime } from '../lib/dates.js';
import { isHighlighted } from '../lib/game.js';
import { getVenue, getVenueMapsUrl } from '../lib/venues.js';
import ClubLogo from './ClubLogo.jsx';

const teamsBySlug = new Map(teams.map((team) => [team.slug, team]));

function Side({ side, winner }) {
  const team = teamsBySlug.get(side.club);
  const name = team?.name ?? side.name ?? side.club;

  return (
    <div className={`game-card__side${winner ? ' game-card__side--winner' : ''}`}>
      <ClubLogo team={team ?? { name, logo: null }} />
      <span className="game-card__club">{name}</span>
      {side.score != null && <span className="game-card__score">{side.score}</span>}
    </div>
  );
}

export default function GameCard({ game }) {
  const { home, away, played } = game;
  const className = `game-card${isHighlighted(game) ? ' game-card--highlighted' : ''}`;
  const hasScore = home.score != null && away.score != null;
  const venue = hasScore ? undefined : getVenue(game.venue);
  const maps = getVenueMapsUrl(venue);
  const VenueBox = maps ? 'a' : 'div';
  const homeWins = played && home.score > away.score;
  const awayWins = played && away.score > home.score;
  const day = formatDay(gameDay(game.date));
  const time = gameTime(game.date);
  const mapsLink = maps
    ? {
        href: maps,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': `${[day, time, venue.name].filter(Boolean).join(', ')} (abrir en Google Maps)`,
      }
    : undefined;

  const meta = (
    <div className={`game-card__meta${venue ? ' game-card__meta--with-venue' : ''}`}>
      {!venue && (
        <span>
          {day}
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
          <VenueBox
            className="game-card__venue"
            title={[venue.name, venue.address].filter(Boolean).join(' — ')}
            {...mapsLink}
          >
            <span>{day}</span>
            {time && <strong>{time}</strong>}
            <span>{venue.name}</span>
          </VenueBox>
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
