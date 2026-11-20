import { describe, expect, it } from 'vitest';
import { formatClock, getMadeBaskets } from './play-by-play.js';

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
