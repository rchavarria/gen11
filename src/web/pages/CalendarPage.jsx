import { useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import GameCard from '../components/GameCard.jsx';
import UpcomingGames from '../components/UpcomingGames.jsx';
import calendar from '../lib/calendar.js';
import {
  formatMonth,
  formatWeek,
  gameDay,
  madridToday,
  monthKey,
  parseMonthKey,
  shiftMonth,
  weeksOfMonth,
} from '../lib/dates.js';

export default function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const today = madridToday();
  const month = parseMonthKey(params.get('m')) ?? parseMonthKey(today.slice(0, 7));
  const { year, month: monthIndex } = month;
  const headerRef = useRef(null);
  const currentWeekRef = useRef(null);
  const previousMonthRef = useRef(null);

  const weeks = useMemo(
    () =>
      weeksOfMonth({ year, month: monthIndex }).map((week) => ({
        ...week,
        isCurrent: week.start <= today && today <= week.end,
        games: calendar.filter((game) => week.start <= gameDay(game.date) && gameDay(game.date) <= week.end),
      })),
    [year, monthIndex, today],
  );

  useLayoutEffect(() => {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (previousMonthRef.current === key) return;
    const initial = previousMonthRef.current === null;
    previousMonthRef.current = key;
    if (initial && key === today.slice(0, 7) && currentWeekRef.current && headerRef.current) {
      const top = window.scrollY + currentWeekRef.current.getBoundingClientRect().top;
      const headerHeight = headerRef.current.getBoundingClientRect().height;
      window.scrollTo({ top: Math.max(0, top - headerHeight - 16), behavior: 'auto' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [year, monthIndex, today]);

  const goTo = (delta) => {
    const next = shiftMonth(month, delta);
    setParams({ m: monthKey(new Date(next.year, next.month, 1)) });
  };

  return (
    <main>
      <div className="calendar-header" ref={headerRef}>
        <UpcomingGames />
        <div className="calendar-header__nav">
          <header className="month-nav">
            <button type="button" onClick={() => goTo(-1)} aria-label="Mes anterior">
              ‹
            </button>
            <h1>{formatMonth(month)}</h1>
            <button type="button" onClick={() => goTo(1)} aria-label="Mes siguiente">
              ›
            </button>
          </header>
        </div>
      </div>
      <div className="page">
        {weeks.map((week) => (
          <section
            key={week.start}
            ref={week.isCurrent ? currentWeekRef : undefined}
            className={`week${week.isCurrent ? ' week--current' : ''}`}
          >
            <h2 className="week__title">{formatWeek(week)}</h2>
            {week.games.length === 0 ? (
              <p className="week__empty">Sin partidos</p>
            ) : (
              <div className="week__games">
                {week.games.map((game) => (
                  <GameCard key={game.slug} game={game} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
