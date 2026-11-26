// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PlayByPlay from './PlayByPlay.jsx';

afterEach(cleanup);

const foul = (id, type, team, jersey, clock) => ({ id, quarter: 3, clock, type, team, jersey });

const sub = (id, type, team, jersey, clock) => ({ id, quarter: 1, clock, type: `substitution-${type}`, team, jersey });

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
  foul(2, 'foul-received', 'home', '4', '00:01:12.0'),
  foul(18, 'foul-committed', 'away', '8', '00:01:12.0'),
  foul(17, 'technical-foul', 'home', '5', '00:02:00.0'),
  foul(16, 'unsportsmanlike-foul', 'away', '9', '00:03:00.0'),
  foul(15, 'disqualifying-foul', 'home', '11', '00:04:00.0'),
  foul(14, 'coach-technical-foul', 'away', 'ENTRENADOR/A', '00:05:00.0'),
  foul(13, 'bench-technical-foul', 'home', 'ENT. AYUDANTE', '00:06:00.0'),
  foul(12, 'disruptive-foul', 'away', '12', '00:07:00.0'),
  foul(11, 'flagrant-foul', 'home', '14', '00:08:00.0'),
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
  sub(28, 'out', 'home', '6', '00:09:40.0'),
  sub(27, 'in', 'home', '9', '00:09:40.0'),
  sub(26, 'out', 'away', '5', '00:09:50.0'),
  sub(25, 'out', 'away', 'X', '00:09:50.0'),
  sub(24, 'in', 'away', '20', '00:09:50.0'),
  sub(23, 'in', 'away', '21', '00:09:50.0'),
  { id: 0, quarter: 1, clock: '00:10:00.0', type: 'period-start', team: null, jersey: '-1' },
  sub(22, 'in', 'home', '4', '00:10:00.0'),
  sub(21, 'in', 'home', '6', '00:10:00.0'),
  sub(20, 'in', 'home', 'X', '00:10:00.0'),
];

function renderItems() {
  render(<PlayByPlay playByPlay={playByPlay} homeName="Local" awayName="Visitante" />);
  return within(screen.getByRole('list', { name: 'Jugada a jugada' })).getAllByRole('listitem');
}

const parts = (element) => [...element.children].map((part) => part.textContent);

/** Renders the timeline and returns the foul card at `index`, checking its centre block. */
function renderFoulCard(index) {
  const card = renderItems()[index];
  expect(within(card).getByRole('img', { name: 'Falta' }).textContent).toBe('✋');
  return card;
}

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

  it('leaves out actions that are not shown, such as a received foul', () => {
    const items = renderItems();

    expect(items).toHaveLength(15);
    expect(screen.queryByText('#4')).toBeNull();
  });

  it('shows a personal foul as a card with a hand in the centre', () => {
    const card = renderFoulCard(2);

    expect(card.className).toContain('play-by-play__card--away');
    expect(parts(card.lastElementChild)).toEqual(['#8', 'Falta personal', '1:12', 'Q3']);
  });

  it('shows a technical foul', () => {
    const card = renderFoulCard(3);

    expect(card.className).toContain('play-by-play__card--home');
    expect(parts(card.firstElementChild)).toEqual(['Q3', '2:00', 'Técnica', '#5']);
  });

  it('shows an unsportsmanlike foul', () => {
    const card = renderFoulCard(4);

    expect(card.className).toContain('play-by-play__card--away');
    expect(parts(card.lastElementChild)).toEqual(['#9', 'Antideportiva', '3:00', 'Q3']);
  });

  it('shows a disqualifying foul', () => {
    const card = renderFoulCard(5);

    expect(card.className).toContain('play-by-play__card--home');
    expect(parts(card.firstElementChild)).toEqual(['Q3', '4:00', 'Descalificante', '#11']);
  });

  it('shows a coach technical foul without jersey', () => {
    const card = renderFoulCard(6);

    expect(card.className).toContain('play-by-play__card--away');
    expect(parts(card.lastElementChild)).toEqual(['Técnica al entrenador', '5:00', 'Q3']);
  });

  it('shows a bench technical foul without jersey', () => {
    const card = renderFoulCard(7);

    expect(card.className).toContain('play-by-play__card--home');
    expect(parts(card.firstElementChild)).toEqual(['Q3', '6:00', 'Técnica al banquillo']);
  });

  it('shows a disruptive foul', () => {
    const card = renderFoulCard(8);

    expect(card.className).toContain('play-by-play__card--away');
    expect(parts(card.lastElementChild)).toEqual(['#12', 'Disruptiva', '7:00', 'Q3']);
  });

  it('shows a flagrant foul', () => {
    const card = renderFoulCard(9);

    expect(card.className).toContain('play-by-play__card--home');
    expect(parts(card.firstElementChild)).toEqual(['Q3', '8:00', 'Flagrante', '#14']);
  });

  it('shows a free throw as a card for the home team', () => {
    const card = renderItems()[10];

    expect(card.className).toContain('play-by-play__card--home');
    expect(card.getAttribute('aria-label')).toBe('Local');
    expect(parts(card)).toEqual(['Q19:30Tiro libre#10', '1–0', '']);
    expect(parts(card.firstElementChild)).toEqual(['Q1', '9:30', 'Tiro libre', '#10']);
  });

  it('shows a substitution as a card with the players going in and out', () => {
    const card = renderItems()[11];

    expect(card.className).toContain('play-by-play__card--home');
    expect(within(card).getByRole('img', { name: 'Cambio' }).textContent).toBe('🔄');
    expect(parts(card.firstElementChild)).toEqual(['Q1', '9:40', 'Entra #9 · Sale #6']);
  });

  it('shows several players changed at once in a single card', () => {
    const card = renderItems()[12];

    expect(card.className).toContain('play-by-play__card--away');
    expect(within(card).getByRole('img', { name: 'Cambio' }).textContent).toBe('🔄');
    expect(parts(card.lastElementChild)).toEqual(['Entra #20 #21 · Sale #5 #X', '9:50', 'Q1']);
  });

  it('shows a period start as a separator', () => {
    const mark = renderItems()[13];

    expect(mark.className).toContain('play-by-play__mark--period-start');
    expect(mark.textContent).toBe('Inicio de cuarto Q1');
  });

  it('shows the lineup at the period start as a card', () => {
    const card = renderItems()[14];

    expect(card.className).toContain('play-by-play__card--home');
    expect(within(card).getByRole('img', { name: 'Quinteto' }).textContent).toBe('🔄');
    expect(parts(card.firstElementChild)).toEqual(['Q1', '10:00', 'Quinteto: #4 #6 #X']);
  });

  it('shows a notice when there are no baskets', () => {
    render(<PlayByPlay playByPlay={undefined} homeName="Local" awayName="Visitante" />);

    expect(screen.getByText('Jugada a jugada no disponible.')).toBeTruthy();
  });
});
