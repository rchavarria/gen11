import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clubs from '../../data/clubs.json';
import calendar from '../lib/calendar.js';
import { formatDay, gameDay, gameTime, madridToday } from '../lib/dates.js';
import { isHighlighted, shortCategory } from '../lib/game.js';
import ClubLogo from './ClubLogo.jsx';

const clubsBySlug = new Map(clubs.map((club) => [club.slug, club]));

function Club({ slug }) {
  const club = clubsBySlug.get(slug);
  if (!club) throw new Error(`Club no encontrado: ${slug}`);

  return (
    <div className="upcoming-card__club" title={club.name}>
      <ClubLogo club={club} />
      <span>{club.initials}</span>
    </div>
  );
}

function UpcomingCard({ game }) {
  const time = gameTime(game.date);
  const category = shortCategory(game.category);

  return (
    <li className={`upcoming-card${isHighlighted(game) ? ' upcoming-card--highlighted' : ''}`}>
      <div className="upcoming-card__header">
        {category && (
          <span
            className={`upcoming-card__category upcoming-card__category--${category.toLowerCase()}`}
            title={game.category}
          >
            {category}
          </span>
        )}
      </div>
      <div className="upcoming-card__body">
        <div className="upcoming-card__when">
          {time && <strong>{time}</strong>}
          <span>{formatDay(gameDay(game.date))}</span>
        </div>
        <div className="upcoming-card__clubs">
          <Club slug={game.home.club} />
          <Club slug={game.away.club} />
        </div>
      </div>
    </li>
  );
}

export default function UpcomingGames() {
  const today = madridToday();
  const listRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const games = useMemo(
    () =>
      calendar
        .filter((game) => gameDay(game.date) >= today && (game.home.score == null || game.away.score == null))
        .sort((a, b) => a.date - b.date),
    [today],
  );

  const updateEdges = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setEdges({
      start: list.scrollLeft <= 1,
      end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 1,
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Recalculate scroll edges when the number of cards changes.
  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges, games.length]);

  const scroll = (direction) => {
    const list = listRef.current;
    list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="upcoming" aria-label="Próximos partidos">
      {games.length === 0 ? (
        <p className="upcoming__empty">No hay próximos partidos</p>
      ) : (
        <>
          <button
            type="button"
            className="upcoming__nav upcoming__nav--prev"
            onClick={() => scroll(-1)}
            disabled={edges.start}
            aria-label="Anteriores"
          >
            ‹
          </button>
          <ul className="upcoming__list" ref={listRef} onScroll={updateEdges}>
            {games.map((game) => (
              <UpcomingCard key={game.slug} game={game} />
            ))}
          </ul>
          <button
            type="button"
            className="upcoming__nav upcoming__nav--next"
            onClick={() => scroll(1)}
            disabled={edges.end}
            aria-label="Siguientes"
          >
            ›
          </button>
        </>
      )}
    </section>
  );
}
