// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Boxscore from './Boxscore.jsx';

test('shows an unavailable message when player statistics are missing', () => {
  render(<Boxscore clubName="Alcobendas" />);

  expect(screen.getByText('Estadísticas no disponibles.')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('renders players in jersey order, formatted stats and team totals', () => {
  const players = [
    {
      jersey: '10', msPlayed: 1019000, freeThrows: { made: 1 },
      twoPointers: { made: 2 }, threePointers: { made: 3 }, efficiency: 8, plusMinus: 5,
    },
    {
      jersey: '4', msPlayed: 60000, freeThrows: { made: 0 },
      twoPointers: { made: 2 }, threePointers: { made: 0 }, efficiency: -1, plusMinus: -3,
    },
  ];
  render(<Boxscore players={players} clubName="Alcobendas" />);

  const table = screen.getByRole('table', { name: 'Boxscore de Alcobendas' });
  const rows = within(table).getAllByRole('row');
  const rowText = (row) => within(row).getAllByRole('cell').map((cell) => cell.textContent);
  expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('4');
  expect(rowText(rows[1])).toEqual(['01:00', '4', '-1', '-3']);
  expect(within(rows[2]).getByRole('rowheader')).toHaveTextContent('10');
  expect(rowText(rows[2])).toEqual(['16:59', '14', '8', '+5']);
  expect(within(rows[3]).getByRole('rowheader')).toHaveTextContent('Totales');
  expect(rowText(rows[3])).toEqual(['', '18', '7', '']);
});

test('renders an empty team with zero totals', () => {
  render(<Boxscore players={[]} clubName="Alcobendas" />);

  const rows = screen.getAllByRole('row');
  expect(rows).toHaveLength(2);
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['', '0', '0', '']);
});
