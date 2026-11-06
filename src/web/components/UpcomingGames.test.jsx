// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import UpcomingGames from './UpcomingGames.jsx';

const calendar = vi.hoisted(() => []);
vi.mock('../../data/calendar.json', () => ({ default: calendar }));
vi.mock('../../data/clubs.json', () => ({
  default: [
    { slug: 'alcobendas', name: 'Alcobendas', initials: 'ALC', logo: null },
    { slug: 'madrid', name: 'Madrid', initials: 'MAD', logo: null },
    { slug: 'canoe', name: 'Canoe', initials: 'CAN', logo: null },
  ],
}));

function game(slug, date, time, overrides = {}) {
  return {
    slug, date, time, category: 'Cadete Masculino',
    home: { club: 'madrid', score: null },
    away: { club: 'canoe', score: null },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 6, 15));
  calendar.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

test('only lists today and future games with incomplete scores, ordered by date and time', () => {
  calendar.push(
    game('tomorrow-late', '2026-11-07', '18:30:00'),
    game('past', '2026-11-05', '17:00:00'),
    game('finished', '2026-11-08', '19:00:00', {
      home: { club: 'madrid', score: 0 }, away: { club: 'canoe', score: 20 },
    }),
    game('today', '2026-11-06', '09:00:00'),
    game('tomorrow-early', '2026-11-07', '10:00:00'),
    game('partial', '2026-11-08', '12:00:00', {
      home: { club: 'madrid', score: 0 },
    }),
  );
  render(<UpcomingGames />);

  expect(screen.getByRole('region', { name: 'Próximos partidos' })).toBeInTheDocument();
  const cards = screen.getAllByRole('listitem');
  expect(cards).toHaveLength(4);
  expect(cards.map((card) => card.querySelector('strong').textContent))
    .toEqual(['09:00', '10:00', '18:30', '12:00']);
  expect(screen.queryByText('17:00')).not.toBeInTheDocument();
  expect(screen.queryByText('19:00')).not.toBeInTheDocument();
});

test('shows category badges and highlights Alcobendas in either position', () => {
  calendar.push(
    game('home', '2026-11-06', '18:30:00', {
      home: { club: 'alcobendas', score: null },
    }),
    game('away', '2026-11-07', '00:00:00', {
      category: 'Junior Masculino',
      away: { club: 'alcobendas', score: null },
    }),
    game('other', '2026-11-08', null),
  );
  render(<UpcomingGames />);

  const [home, away, other] = screen.getAllByRole('listitem');
  expect(home).toHaveClass('upcoming-card--highlighted');
  expect(away).toHaveClass('upcoming-card--highlighted');
  expect(other).not.toHaveClass('upcoming-card--highlighted');
  expect(within(home).getByText('CAD')).toHaveClass('upcoming-card__category--cad');
  expect(within(away).getByText('JUN')).toHaveClass('upcoming-card__category--jun');
  expect(within(away).getByText('JUN')).toHaveAttribute('title', 'Junior Masculino');
  expect(within(home).getByTitle('Alcobendas')).toHaveTextContent('ALC');
  expect(away.querySelector('strong')).toBeNull();
});

test('renders nothing when no upcoming games qualify', () => {
  calendar.push(game('past', '2026-11-05', '17:00:00'));
  const { container } = render(<UpcomingGames />);

  expect(container).toBeEmptyDOMElement();
});
