// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import GameCard from './GameCard.jsx';

vi.mock('../../data/clubs.json', () => ({
  default: [
    { slug: 'alcobendas', name: 'Alcobendas', logo: null },
    { slug: 'madrid', name: 'Madrid', logo: null },
    { slug: 'canoe', name: 'Canoe', logo: null },
  ],
}));
vi.mock('../../data/venues.json', () => ({
  default: [{ slug: 'central', name: 'Pabellón Central', address: 'Calle Central, 1' }],
}));

const game = {
  slug: 'madrid-canoe',
  date: '2026-11-06',
  time: '18:30',
  category: 'Cadete Masculino',
  played: true,
  home: { club: 'madrid', score: 80 },
  away: { club: 'canoe', score: 70 },
};

function renderCard(overrides = {}) {
  return render(
    <MemoryRouter>
      <GameCard game={{ ...game, ...overrides }} />
    </MemoryRouter>,
  );
}

test('shows clubs, schedule, category and a link to the game detail', () => {
  renderCard();

  expect(screen.getByRole('link')).toHaveAttribute('href', '/game/madrid-canoe');
  expect(screen.getByText('Madrid')).toBeInTheDocument();
  expect(screen.getByText('Canoe')).toBeInTheDocument();
  expect(screen.getByText(/18:30/)).toBeInTheDocument();
  expect(screen.getByText('Cadete Masculino')).toBeInTheDocument();
  expect(screen.getByRole('link')).not.toHaveClass('game-card--highlighted');
});

test.each([
  [80, 70, true, 'Madrid'],
  [0, 20, true, 'Canoe'],
  [70, 70, true, null],
  [80, 70, false, null],
])('only marks the winner of a played game (%s-%s, played=%s)', (home, away, played, winner) => {
  const { container } = renderCard({
    played,
    home: { club: 'madrid', score: home },
    away: { club: 'canoe', score: away },
  });

  expect(screen.getByRole('link')).toBeInTheDocument();
  const winningSide = container.querySelector('.game-card__side--winner');
  if (winner) expect(winningSide).toHaveTextContent(winner);
  else expect(winningSide).toBeNull();
});

test.each([
  [null, null],
  [0, null],
  [null, 20],
])('does not link games with incomplete scores (%s-%s)', (home, away) => {
  const { container } = renderCard({
    played: false,
    home: { club: 'madrid', score: home },
    away: { club: 'canoe', score: away },
  });

  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(container.querySelector('.game-card')).toBeInTheDocument();
  expect(container.querySelector('.game-card__side--winner')).toBeNull();
});

test.each([
  ['alcobendas', 'madrid', true],
  ['madrid', 'alcobendas', true],
  ['alcobendas', 'madrid', false],
  ['madrid', 'alcobendas', false],
])('highlights Alcobendas home or away, played or pending (%s-%s, %s)', (home, away, played) => {
  const { container } = renderCard({
    played,
    home: { club: home, score: played ? 80 : null },
    away: { club: away, score: played ? 70 : null },
  });

  expect(container.firstChild).toHaveClass('game-card--highlighted');
});

test('rejects unknown clubs instead of showing an incomplete card', () => {
  expect(() => renderCard({ home: { club: 'unknown', score: 80 } })).toThrow('Club no encontrado: unknown');
});

test.each([
  [null, null],
  [0, null],
  [null, 20],
])('shows the venue on calendar cards with incomplete scores (%s-%s)', (home, away) => {
  renderCard({
    venue: 'central',
    played: false,
    home: { club: 'madrid', score: home },
    away: { club: 'canoe', score: away },
  });

  const venue = screen.getByText('Pabellón Central').closest('.game-card__venue');
  expect(venue).toHaveAttribute('title', 'Pabellón Central — Calle Central, 1');
  expect(Array.from(venue.children, (line) => line.textContent)).toEqual(['vie 6 nov', '18:30', 'Pabellón Central']);
  expect(within(venue).getByText('18:30').tagName).toBe('STRONG');
  expect(screen.getAllByText('vie 6 nov')).toHaveLength(1);
  expect(venue.closest('.game-card').querySelector('.game-card__meta')).not.toHaveTextContent('vie 6 nov');
  expect(venue.closest('.game-card').querySelector('.game-card__meta')).not.toHaveTextContent('18:30');
  expect(venue.parentElement).toHaveClass('game-card__body--with-venue');
  expect(venue.parentElement.firstElementChild).toBe(venue);
  const clubs = venue.nextElementSibling;
  expect(within(clubs).getByText('Cadete Masculino')).toBeInTheDocument();
  expect(within(clubs).getByText('Madrid')).toBeInTheDocument();
  expect(within(clubs).getByText('Canoe')).toBeInTheDocument();
  expect(clubs.querySelectorAll('.game-card__score')).toHaveLength(home != null || away != null ? 1 : 0);
});

test.each(['', undefined, 'unknown'])('omits missing or unknown calendar venues (%s)', (venue) => {
  const { container } = renderCard({
    venue,
    played: false,
    home: { club: 'madrid', score: null },
    away: { club: 'canoe', score: null },
  });

  expect(container.querySelector('.game-card__venue')).toBeNull();
  expect(container.querySelector('.game-card__meta')).toHaveTextContent('vie 6 nov · 18:30');
});

test('omits the time line when the venue is known but the time is unknown', () => {
  renderCard({
    venue: 'central',
    time: null,
    played: false,
    home: { club: 'madrid', score: null },
    away: { club: 'canoe', score: null },
  });

  const venue = screen.getByText('Pabellón Central').closest('.game-card__venue');
  expect(Array.from(venue.children, (line) => line.textContent)).toEqual(['vie 6 nov', 'Pabellón Central']);
  expect(venue.querySelector('strong')).toBeNull();
});

test('omits the venue on calendar cards with complete scores, including zero', () => {
  renderCard({
    venue: 'central',
    home: { club: 'madrid', score: 0 },
  });

  expect(screen.queryByText('Pabellón Central')).not.toBeInTheDocument();
});
