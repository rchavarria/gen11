import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  boxscoreTotals, formatPlayed, formatPlusMinus, playerPoints, sortByJersey,
} from './boxscore.js';

const player = (jersey, made, efficiency = 0) => ({
  jersey,
  freeThrows: { made: made[0] },
  twoPointers: { made: made[1] },
  threePointers: { made: made[2] },
  efficiency,
});

test('played time is formatted as mm:ss', () => {
  assert.equal(formatPlayed(1019177), '16:59');
  assert.equal(formatPlayed(0), '00:00');
  assert.equal(formatPlayed(12000000), '200:00');
});

test('points add free throws, twos and threes', () => {
  assert.equal(playerPoints(player('5', [1, 2, 3])), 14);
});

test('plus/minus shows the sign of positive values', () => {
  assert.equal(formatPlusMinus(5), '+5');
  assert.equal(formatPlusMinus(-3), '-3');
  assert.equal(formatPlusMinus(0), '0');
});

test('players are sorted by numeric jersey with non-numeric ones last', () => {
  const sorted = sortByJersey([player('X', [0, 0, 0]), player('10', [0, 0, 0]), player('X', [1, 0, 0]), player('4', [0, 0, 0])]);
  assert.deepEqual(sorted.map((p) => p.jersey), ['4', '10', 'X', 'X']);
  assert.equal(sorted[2].freeThrows.made, 0);
  assert.equal(sorted[3].freeThrows.made, 1);
});

test('totals sum points and efficiency', () => {
  assert.deepEqual(
    boxscoreTotals([player('1', [1, 1, 1], 4), player('2', [0, 2, 0], -1)]),
    { points: 10, efficiency: 3 },
  );
});
