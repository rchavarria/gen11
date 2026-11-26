// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PlayByPlay from './PlayByPlay.jsx';

afterEach(cleanup);

const playByPlay = [
  { id: 5, quarter: 5, clock: '00:00:00.0', type: 'period-end', team: null, jersey: '-1' },
  {
    id: 3,
    quarter: 5,
    clock: '00:00:05.3',
    type: 'three-point-made',
    team: 'away',
    jersey: '7',
    homeScore: 60,
    awayScore: 63,
  },
  { id: 2, quarter: 4, clock: '00:01:12.0', type: 'foul', team: 'home', jersey: '4' },
  {
    id: 1,
    quarter: 1,
    clock: '00:09:30.0',
    type: 'free-throw-made',
    team: 'home',
    jersey: '10',
    homeScore: 1,
    awayScore: 0,
  },
  { id: 0, quarter: 1, clock: '00:10:00.0', type: 'period-start', team: null, jersey: '-1' },
];

function renderItems() {
  render(<PlayByPlay playByPlay={playByPlay} homeName="Local" awayName="Visitante" />);
  return within(screen.getByRole('list', { name: 'Jugada a jugada' })).getAllByRole('listitem');
}

const parts = (element) => [...element.children].map((part) => part.textContent);

describe('PlayByPlay', () => {
  it('shows a period end as a separator', () => {
    const [mark] = renderItems();

    expect(mark.className).toContain('play-by-play__mark--period-end');
    expect(mark.textContent).toBe('Fin de prórroga OT1');
  });

  it('shows a three-pointer as a card mirrored for the away team', () => {
    const card = renderItems()[1];

    expect(card.className).toContain('play-by-play__card--away');
    expect(card.getAttribute('aria-label')).toBe('Visitante');
    expect(parts(card)).toEqual(['', '60–63', '#7Triple0:05OT']);
    expect(parts(card.lastElementChild)).toEqual(['#7', 'Triple', '0:05', 'OT']);
  });

  it('leaves out actions that are neither baskets nor period marks', () => {
    const items = renderItems();

    expect(items).toHaveLength(4);
    expect(screen.queryByText('#4')).toBeNull();
  });

  it('shows a free throw as a card for the home team', () => {
    const card = renderItems()[2];

    expect(card.className).toContain('play-by-play__card--home');
    expect(card.getAttribute('aria-label')).toBe('Local');
    expect(parts(card)).toEqual(['Q19:30Tiro libre#10', '1–0', '']);
    expect(parts(card.firstElementChild)).toEqual(['Q1', '9:30', 'Tiro libre', '#10']);
  });

  it('shows a period start as a separator', () => {
    const mark = renderItems()[3];

    expect(mark.className).toContain('play-by-play__mark--period-start');
    expect(mark.textContent).toBe('Inicio de cuarto Q1');
  });

  it('shows a notice when there are no baskets', () => {
    render(<PlayByPlay playByPlay={undefined} homeName="Local" awayName="Visitante" />);

    expect(screen.getByText('Jugada a jugada no disponible.')).toBeTruthy();
  });
});
