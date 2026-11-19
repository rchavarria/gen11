// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import GameCard from './GameCard.jsx';

vi.mock('../../data/teams.json', () => ({
  default: [
    { slug: 'alcobendas', name: 'Alcobendas', club: 'BALONCESTO ALCOBENDAS', logo: null },
    { slug: 'madrid-b', name: 'Madrid B', club: 'Real Madrid', logo: 'madrid-b.png' },
    { slug: 'madrid', name: 'Madrid', club: 'Real Madrid', logo: null },
    { slug: 'canoe', name: 'Canoe', logo: null },
  ],
}));
vi.mock('../../data/venues.json', () => ({
  default: [
    { slug: 'central', name: 'Pabellón Central', address: 'Calle Central, 1', maps: 'https://maps.app.goo.gl/example' },
    { slug: 'north', name: 'Pabellón Norte' },
    { slug: 'south', name: 'Pabellón Sur', maps: '/invalid' },
  ],
}));

const game = {
  slug: 'madrid-canoe',
  date: new Date('2026-11-06T17:30:00Z'),
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

test('shows unresolved team names with a placeholder logo', () => {
  const { container } = renderCard({ home: { club: 'unknown', name: 'Equipo pendiente', score: 80 } });
  expect(screen.getByText('Equipo pendiente')).toBeInTheDocument();
  expect(container.querySelector('.club-logo--placeholder')).toBeInTheDocument();
});

test('shows the specific team name and logo when teams share a club', () => {
  const { container } = renderCard({
    home: { club: 'madrid-b', score: 80 },
    away: { club: 'madrid', score: 70 },
  });
  expect(screen.getByText('Madrid B')).toBeInTheDocument();
  expect(screen.getByText('Madrid')).toBeInTheDocument();
  expect(screen.queryByText('Real Madrid')).not.toBeInTheDocument();
  expect(container.querySelector('img')).toHaveAttribute('src', `${import.meta.env.BASE_URL}logos/madrid-b.png`);
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

test('links the whole date, time and venue box to Google Maps in a new tab', () => {
  renderCard({
    venue: 'central',
    home: { club: 'madrid', score: null },
    away: { club: 'canoe', score: null },
  });

  const link = screen.getByRole('link', { name: /abrir en Google Maps/ });
  expect(link).toHaveClass('game-card__venue');
  expect(within(link).getByText('vie 6 nov')).toBeInTheDocument();
  expect(within(link).getByText('18:30')).toBeInTheDocument();
  expect(within(link).getByText('Pabellón Central')).toBeInTheDocument();
  expect(link).toHaveAttribute('href', 'https://maps.app.goo.gl/example');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test.each([
  ['north', 'Pabellón Norte'],
  ['south', 'Pabellón Sur'],
])('shows the venue name without a link when the URL is missing or invalid (%s)', (venue, name) => {
  renderCard({
    venue,
    home: { club: 'madrid', score: null },
    away: { club: 'canoe', score: null },
  });

  expect(screen.getByText(name)).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
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
    date: new Date('2026-11-06T00:00:00Z'),
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
