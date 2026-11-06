// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
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
