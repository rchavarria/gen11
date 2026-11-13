import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { isUtcIsoDateTime, madridDay, madridToUtcIso, toIsoDate } from './dates.js';
import { isAfterToday } from './download.js';

test.each([
  ['2026-11-06', '18:30:00', '2026-11-06T17:30:00Z'],
  ['2026-05-10', '11:30:00', '2026-05-10T09:30:00Z'],
  ['2026-11-09', '00:30:00', '2026-11-08T23:30:00Z'],
  ['2026-03-29', '01:30:00', '2026-03-29T00:30:00Z'],
  ['2026-03-29', '03:30:00', '2026-03-29T01:30:00Z'],
  ['2026-10-25', '02:30:00', '2026-10-25T00:30:00Z'],
  ['2026-11-06', '00:00:00', '2026-11-06T00:00:00Z'],
  ['2026-11-06', '', '2026-11-06T00:00:00Z'],
  ['2026-11-06', '25:30:00', '2026-11-06T00:00:00Z'],
  ['2026-03-29', '02:30:00', ''],
  ['2026-02-31', '10:00:00', ''],
])('converts Madrid %s %s to UTC %s', (day, time, expected) => {
  assert.equal(madridToUtcIso(day, time), expected);
});

test('validates UTC dates and extracts Madrid game days including the unknown-time marker', () => {
  assert.equal(toIsoDate('31/02/2026'), '');
  assert.equal(isUtcIsoDateTime('2026-02-31T12:00:00Z'), false);
  assert.equal(isUtcIsoDateTime('2026-11-09T00:00:00Z'), true);
  assert.equal(madridDay('2026-11-08T23:30:00Z'), '2026-11-09');
  assert.equal(madridDay('2026-11-09T00:00:00Z'), '2026-11-09');
});

test('future downloads use Madrid calendar days independently of system time zone', () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-08T23:15:00Z'));
    assert.equal(isAfterToday('2026-11-08T23:30:00Z'), false);
    assert.equal(isAfterToday('2026-11-09T00:00:00Z'), false);
    assert.equal(isAfterToday('2026-11-10T00:00:00Z'), true);
  } finally {
    vi.useRealTimers();
  }
});
