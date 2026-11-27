import { describe, expect, it } from 'vitest';
import { formatClock, getMadeBaskets, getTimeline, periodMarkLabel, substitutionText } from './play-by-play.js';

describe('getMadeBaskets', () => {
  it('keeps only made baskets in the original order', () => {
    const actions = [
      { id: 1, type: 'three-point-made' },
      { id: 2, type: 'two-point-missed' },
      { id: 3, type: 'free-throw-made' },
      { id: 4, type: 'foul' },
      { id: 5, type: 'two-point-made' },
    ];

    expect(getMadeBaskets(actions).map((action) => action.id)).toEqual([1, 3, 5]);
  });

  it('returns an empty list when there is no play-by-play', () => {
    expect(getMadeBaskets(undefined)).toEqual([]);
  });
});

describe('getTimeline', () => {
  it('keeps baskets, fouls, rebounds, timeouts and period marks in order, dropping a repeated mark', () => {
    const actions = [
      { id: 7, type: 'period-end', quarter: 4 },
      { id: 6, type: 'period-end', quarter: 4 },
      { id: 5, type: 'two-point-made', quarter: 4 },
      { id: 9, type: 'foul-received', quarter: 4 },
      { id: 4, type: 'foul-committed', quarter: 4 },
      { id: 8, type: 'coach-technical-foul', quarter: 4 },
      { id: 10, type: 'timeout', quarter: 4 },
      { id: 11, type: 'defensive-rebound', quarter: 4 },
      { id: 12, type: 'offensive-rebound', quarter: 4 },
      { id: 13, type: 'two-point-missed', quarter: 4 },
      { id: 3, type: 'period-start', quarter: 4 },
      { id: 2, type: 'period-end', quarter: 3 },
      { id: 1, type: 'game-start', quarter: 1 },
    ];

    expect(getTimeline(actions).map((action) => action.id)).toEqual([7, 5, 4, 8, 10, 11, 12, 3, 2]);
    expect(getTimeline(undefined)).toEqual([]);
  });

  const sub = (id, type, team, jersey, clock = '00:04:12.0', quarter = 2) => ({
    id,
    type: `substitution-${type}`,
    team,
    jersey,
    clock,
    quarter,
  });

  it('groups the substitutions of a team at the same moment', () => {
    const actions = [
      sub(4, 'in', 'home', '7'),
      sub(3, 'in', 'home', '11'),
      sub(2, 'out', 'home', '4'),
      sub(1, 'out', 'home', 'X'),
    ];

    expect(getTimeline(actions)).toEqual([
      { id: 4, type: 'substitution', team: 'home', quarter: 2, clock: '00:04:12.0', in: ['7', '11'], out: ['4', 'X'] },
    ]);
  });

  it('does not group substitutions of different teams or moments', () => {
    const actions = [
      sub(4, 'in', 'home', '7'),
      sub(3, 'in', 'away', '11'),
      sub(2, 'out', 'away', '4', '00:04:10.0'),
      sub(1, 'out', 'away', '9', '00:04:10.0', 3),
    ];

    expect(getTimeline(actions).map((item) => [item.id, item.in, item.out])).toEqual([
      [4, ['7'], []],
      [3, ['11'], []],
      [2, [], ['4']],
      [1, [], ['9']],
    ]);
  });

  it('does not group substitutions split by another action', () => {
    const actions = [
      sub(3, 'in', 'home', '7'),
      { id: 2, type: 'foul-committed', team: 'home' },
      sub(1, 'out', 'home', '4'),
    ];

    expect(getTimeline(actions).map((item) => item.id)).toEqual([3, 2, 1]);
  });

  it('marks players going in at the period start as the lineup', () => {
    const actions = [
      sub(3, 'in', 'home', '7', '00:10:00.0', 1),
      sub(2, 'in', 'home', '8', '00:10:00.0', 1),
      sub(1, 'in', 'away', '5', '00:05:00.0', 5),
    ];

    expect(getTimeline(actions).map((item) => [item.type, item.in])).toEqual([
      ['lineup', ['7', '8']],
      ['lineup', ['5']],
    ]);
  });

  it('keeps a full-clock substitution with players going out as a substitution', () => {
    const actions = [sub(2, 'in', 'home', '7', '00:10:00.0', 1), sub(1, 'out', 'home', '4', '00:10:00.0', 1)];

    expect(getTimeline(actions)[0].type).toBe('substitution');
  });
});

describe('substitutionText', () => {
  it('lists the players going in and out', () => {
    expect(substitutionText({ type: 'substitution', in: ['7', '11'], out: ['4', 'X'] })).toBe(
      'Entra #7 #11 · Sale #4 #X',
    );
    expect(substitutionText({ type: 'substitution', in: [], out: ['4'] })).toBe('Sale #4');
    expect(substitutionText({ type: 'substitution', in: ['7'], out: [] })).toBe('Entra #7');
  });

  it('lists the lineup', () => {
    expect(substitutionText({ type: 'lineup', in: ['7', '8', 'X'], out: [] })).toBe('Quinteto: #7 #8 #X');
  });
});

describe('periodMarkLabel', () => {
  it('names quarters and overtimes', () => {
    expect(periodMarkLabel({ type: 'period-start', quarter: 1 })).toBe('Inicio de cuarto Q1');
    expect(periodMarkLabel({ type: 'period-end', quarter: 4 })).toBe('Fin de cuarto Q4');
    expect(periodMarkLabel({ type: 'period-end', quarter: 6 })).toBe('Fin de prórroga OT2');
  });
});

describe('formatClock', () => {
  it('formats the remaining time as m:ss', () => {
    expect(formatClock('00:01:12.0')).toBe('1:12');
    expect(formatClock('00:10:00.0')).toBe('10:00');
    expect(formatClock('00:00:05.3')).toBe('0:05');
  });

  it('returns an empty string for unknown formats', () => {
    expect(formatClock(undefined)).toBe('');
    expect(formatClock('x')).toBe('');
  });
});
