// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import GamePage from './GamePage.jsx';

vi.mock('../../data/teams.json', () => ({
  default: [
    { slug: 'madrid', name: 'Madrid', initials: 'MAD', logo: null },
    { slug: 'madrid-b', name: 'Madrid B', initials: 'MDB', logo: null },
    { slug: 'canoe', name: 'Canoe', initials: 'CAN', logo: null },
  ],
}));
const game = vi.hoisted(() => ({
  date: '2026-10-31T23:30:00Z',
  category: 'Prueba',
  venue: '',
  home: { slug: 'madrid', score: 10, quarterScores: [], timelyScores: [] },
  away: { slug: 'canoe', score: 9, quarterScores: [], timelyScores: [] },
}));
vi.mock('../../data/venues.json', () => ({
  default: [
    { slug: 'central', name: 'Pabellón Central', maps: 'https://maps.app.goo.gl/example' },
    { slug: 'without-maps', name: 'Pabellón Sin Mapa' },
    { slug: 'invalid-maps', name: 'Pabellón URL Inválida', maps: 'not a URL' },
    { slug: 'unsafe-maps', name: 'Pabellón URL No HTTP', maps: 'javascript:alert(1)' },
  ],
}));
vi.mock('../../data/games/s56-kdt-oro-f1-g1-j01-realmadrid-alcobendas.json', () => ({
  default: game,
}));

beforeEach(() => {
  game.date = '2026-10-31T23:30:00Z';
  game.venue = '';
  game.home.slug = 'madrid';
  game.away.slug = 'canoe';
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/game/s56-kdt-oro-f1-g1-j01-realmadrid-alcobendas']}>
      <Routes>
        <Route path="/game/:slug" element={<GamePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

test('shows the game date in Madrid time without a back link', async () => {
  renderPage();
  const date = await screen.findByText('dom 1 nov');
  expect(date).toHaveClass('game-detail__date');
  expect(screen.getByText('00:30')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Volver|Calendario/ })).not.toBeInTheDocument();
  const when = date.closest('.game-detail__when');
  expect(when.querySelectorAll('svg')).toHaveLength(2);
  expect(when.querySelector('.game-detail__separator')).toHaveTextContent('•');
});

test('shows the venue link below the scoreboard with a decorative pin icon', async () => {
  game.venue = 'central';
  renderPage();
  const link = await screen.findByRole('link', { name: 'Pabellón Central' });
  expect(link).toHaveAttribute('href', 'https://maps.app.goo.gl/example');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const block = link.closest('.game-detail__venue');
  const icon = block.querySelector('svg');
  expect(icon).toHaveAttribute('aria-hidden', 'true');
  expect(icon).toHaveAttribute('focusable', 'false');
  expect(icon).toHaveClass('icon');
  expect(block.previousElementSibling).toHaveClass('game-detail__when');
  expect(block.previousElementSibling.previousElementSibling).toHaveClass('game-detail__scoreboard');
});

test('omits the clock and separator when the game time is unknown', async () => {
  game.date = '2026-11-01T00:00:00Z';
  renderPage();
  const date = await screen.findByText('dom 1 nov');
  const when = date.closest('.game-detail__when');
  expect(when.querySelectorAll('svg')).toHaveLength(1);
  expect(when.querySelector('.game-detail__separator')).toBeNull();
});

test('resolves each team name and initials independently in the game detail', async () => {
  game.home.slug = 'madrid-b';
  game.away.slug = 'madrid';
  renderPage();
  expect(await screen.findByRole('heading', { name: 'Madrid B' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Madrid' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'MDB' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'MAD' })).toBeInTheDocument();
});

test.each([
  ['without-maps', 'Pabellón Sin Mapa'],
  ['invalid-maps', 'Pabellón URL Inválida'],
  ['unsafe-maps', 'Pabellón URL No HTTP'],
])('shows only the name for venue %s without a valid maps URL', async (slug, name) => {
  game.venue = slug;
  renderPage();
  const text = await screen.findByText(name);
  expect(text.closest('.game-detail__venue')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
});

test.each(['', 'unknown'])('omits unknown venue %s', async (venue) => {
  game.venue = venue;
  const { container } = renderPage();
  await screen.findByText('dom 1 nov');
  expect(container.querySelector('.game-detail__venue')).toBeNull();
});
