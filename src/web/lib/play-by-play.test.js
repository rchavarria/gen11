import { describe, expect, it } from 'vitest';
import { formatClock, getMadeBaskets, getTimeline, periodMarkLabel } from './play-by-play.js';

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
  it('keeps baskets and period marks in order, dropping a repeated mark', () => {
    const actions = [
      { id: 7, type: 'period-end', quarter: 4 },
      { id: 6, type: 'period-end', quarter: 4 },
      { id: 5, type: 'two-point-made', quarter: 4 },
      { id: 4, type: 'foul', quarter: 4 },
      { id: 3, type: 'period-start', quarter: 4 },
      { id: 2, type: 'period-end', quarter: 3 },
      { id: 1, type: 'game-start', quarter: 1 },
    ];

    expect(getTimeline(actions).map((action) => action.id)).toEqual([7, 5, 3, 2]);
    expect(getTimeline(undefined)).toEqual([]);
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
