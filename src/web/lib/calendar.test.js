import { expect, test, vi } from 'vitest';
import calendar from './calendar.js';
import { gameDay, gameTime } from './dates.js';

vi.mock('../../data/calendar.json', () => ({
  default: [{ slug: 'game', date: '2026-11-01T23:30:00Z' }],
}));

test('converts calendar dates to Date objects when loading', () => {
  expect(calendar[0].date).toBeInstanceOf(Date);
  expect(calendar[0].date.toISOString()).toBe('2026-11-01T23:30:00.000Z');
});

test('formats Date objects in Madrid and preserves the unknown-time marker', () => {
  expect(gameDay(new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
  expect(gameTime(new Date('2026-11-01T23:30:00Z'))).toBe('00:30');
  expect(gameDay(new Date('2026-11-01T00:00:00Z'))).toBe('2026-11-01');
  expect(gameTime(new Date('2026-11-01T00:00:00Z'))).toBeNull();
  expect(gameTime(new Date('2026-05-10T09:30:00Z'))).toBe('11:30');
});
