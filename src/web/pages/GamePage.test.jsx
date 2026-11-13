// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import GamePage from './GamePage.jsx';

vi.mock('../../data/clubs.json', () => ({
  default: [
    { slug: 'madrid', name: 'Madrid', initials: 'MAD', logo: null },
    { slug: 'canoe', name: 'Canoe', initials: 'CAN', logo: null },
  ],
}));
vi.mock('../../data/games/s56-kdt-oro-f1-g1-j1-madrid-alcobendas.json', () => ({
  default: {
    date: '2026-10-31T23:30:00Z',
    category: 'Prueba',
    home: { slug: 'madrid', score: 10, quarterScores: [], timelyScores: [] },
    away: { slug: 'canoe', score: 9, quarterScores: [], timelyScores: [] },
  },
}));

test('returns to the Madrid month when the UTC date is in the previous month', async () => {
  render(
    <MemoryRouter initialEntries={['/game/s56-kdt-oro-f1-g1-j1-madrid-alcobendas']}>
      <Routes>
        <Route path="/game/:slug" element={<GamePage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText('dom 1 nov · 00:30')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Calendario/ })).toHaveAttribute('href', '/?mes=2026-11');
});
