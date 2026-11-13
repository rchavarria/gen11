// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import GamePage from './GamePage.jsx';

vi.mock('../../data/clubs.json', () => ({
  default: [
    { slug: 'madrid', name: 'Madrid', initials: 'MAD', logo: null },
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
vi.mock('../../data/games/s56-kdt-oro-f1-g1-j1-madrid-alcobendas.json', () => ({
  default: game,
}));

beforeEach(() => {
  game.venue = '';
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/game/s56-kdt-oro-f1-g1-j1-madrid-alcobendas']}>
      <Routes>
        <Route path="/game/:slug" element={<GamePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

test('returns to the Madrid month when the UTC date is in the previous month', async () => {
  renderPage();
  expect(await screen.findByText('dom 1 nov')).toHaveClass('game-detail__date');
  expect(screen.getByText('00:30')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Calendario/ })).toHaveAttribute('href', '/?m=2026-11');
});

test('shows the venue link below the scoreboard with a decorative pin', async () => {
  game.venue = 'central';
  renderPage();
  const link = await screen.findByRole('link', { name: 'Pabellón Central' });
  expect(link).toHaveAttribute('href', 'https://maps.app.goo.gl/example');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const block = link.closest('.game-detail__venue');
  expect(block.querySelector('[aria-hidden="true"]')).toHaveTextContent('📍');
  expect(block.previousElementSibling).toHaveClass('game-detail__when');
  expect(block.previousElementSibling.previousElementSibling).toHaveClass('game-detail__scoreboard');
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
