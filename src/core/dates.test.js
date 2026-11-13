import assert from 'node:assert/strict';
import { test } from 'vitest';
import { downloadedToUtcIso, isUtcIsoDateTime, madridDay } from './dates.js';

test.each([
  ['06/11/2026', '18:30:00', '2026-11-06T17:30:00Z'],
  ['10/05/2026', '11:30:00', '2026-05-10T09:30:00Z'],
  ['09/11/2026', '00:30:00', '2026-11-08T23:30:00Z'],
  ['29/03/2026', '01:30:00', '2026-03-29T00:30:00Z'],
  ['29/03/2026', '03:30:00', '2026-03-29T01:30:00Z'],
  ['25/10/2026', '02:30:00', '2026-10-25T00:30:00Z'],
  ['06/11/2026', '00:00:00', '2026-11-06T00:00:00Z'],
  ['06/11/2026', '', '2026-11-06T00:00:00Z'],
  ['06/11/2026', '25:30:00', null],
  ['29/03/2026', '02:30:00', null],
  ['31/02/2026', '10:00:00', null],
])('converts Madrid %s %s to UTC %s', (day, time, expected) => {
  assert.equal(downloadedToUtcIso(day, time), expected);
});

test('validates UTC dates and extracts Madrid game days including the unknown-time marker', () => {
  assert.equal(isUtcIsoDateTime('2026-02-31T12:00:00Z'), false);
  assert.equal(isUtcIsoDateTime('2026-11-09T00:00:00Z'), true);
  assert.equal(madridDay('2026-11-08T23:30:00Z'), '2026-11-09');
  assert.equal(madridDay('2026-11-09T00:00:00Z'), '2026-11-09');
});
