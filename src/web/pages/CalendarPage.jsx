import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import calendar from '../../data/calendar.json';
import GameCard from '../components/GameCard.jsx';
import UpcomingGames from '../components/UpcomingGames.jsx';
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

  const weeks = useMemo(
    () =>
      weeksOfMonth({ year, month: monthIndex }).map((week) => ({
        ...week,
        isCurrent: week.start <= today && today <= week.end,
        games: calendar.filter((game) => week.start <= gameDay(game.date) && gameDay(game.date) <= week.end),
      })),
    [year, monthIndex, today],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset scrolling whenever the displayed month changes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [month.year, month.month]);

  const goTo = (delta) => {
    const next = shiftMonth(month, delta);
    setParams({ m: monthKey(new Date(next.year, next.month, 1)) });
  };

  return (
    <>
      <UpcomingGames />
      <main className="page">
        <header className="month-nav">
          <button type="button" onClick={() => goTo(-1)} aria-label="Mes anterior">
            ‹
          </button>
          <h1>{formatMonth(month)}</h1>
          <button type="button" onClick={() => goTo(1)} aria-label="Mes siguiente">
            ›
          </button>
        </header>

        {weeks.map((week) => (
          <section key={week.start} className={`week${week.isCurrent ? ' week--current' : ''}`}>
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
      </main>
    </>
  );
}
