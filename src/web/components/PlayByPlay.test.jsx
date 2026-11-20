// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PlayByPlay from './PlayByPlay.jsx';

afterEach(cleanup);

const playByPlay = [
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
];

describe('PlayByPlay', () => {
  it('shows made baskets as cards in the original order, mirrored for the away team', () => {
    render(<PlayByPlay playByPlay={playByPlay} homeName="Local" awayName="Visitante" />);

    const cards = within(screen.getByRole('list', { name: 'Canastas del partido' })).getAllByRole('listitem');
    const parts = (card) => [...card.children].map((part) => part.textContent);
    expect(cards).toHaveLength(2);

    expect(cards[0].className).toContain('play-by-play__card--away');
    expect(cards[0].getAttribute('aria-label')).toBe('Visitante');
    expect(parts(cards[0])).toEqual(['60–63', '#7', 'Triple', '0:05', 'OT']);

    expect(cards[1].className).toContain('play-by-play__card--home');
    expect(cards[1].getAttribute('aria-label')).toBe('Local');
    expect(parts(cards[1])).toEqual(['Q1', '9:30', 'Tiro libre', '#10', '1–0']);
  });

  it('shows a notice when there are no baskets', () => {
    render(<PlayByPlay playByPlay={undefined} homeName="Local" awayName="Visitante" />);

    expect(screen.getByText('Jugada a jugada no disponible.')).toBeTruthy();
  });
});
