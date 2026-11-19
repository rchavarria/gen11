import assert from 'node:assert/strict';
import { test } from 'vitest';
import { calculateStandings } from './standings.js';

const config = { type: 'computed', winPoints: 2, lossPoints: 1, walkoverPoints: 0 };
const rounds = [
  { id: 'j01', games: [{ home: { slug: 'b', score: 60 }, away: { slug: 'a', score: 70 } }] },
  { id: 'j02', games: [{ home: { slug: 'a', score: 69 }, away: { slug: 'b', score: 70 } }] },
];

test('ranks A first on head-to-head point difference after each team wins once', () => {
  assert.deepEqual(calculateStandings({ ...config, tieBreaker: ['head-to-head'] }, rounds), [
    { team: 'a', gamesPlayed: 2, wins: 1, losses: 1, pointsFor: 139, pointsAgainst: 130, points: 3 },
    { team: 'b', gamesPlayed: 2, wins: 1, losses: 1, pointsFor: 130, pointsAgainst: 139, points: 3 },
  ]);
});

test('keeps the original order when head-to-head is not configured', () => {
  assert.deepEqual(
    calculateStandings(config, rounds).map(({ team }) => team),
    ['b', 'a'],
  );
});

test('ignores margins against other teams when breaking a two-team tie', () => {
  const schedule = [
    ...rounds,
    { id: 'j03', games: [{ home: { slug: 'b', score: 100 }, away: { slug: 'c', score: 50 } }] },
    { id: 'j04', games: [{ home: { slug: 'a', score: 71 }, away: { slug: 'c', score: 70 } }] },
  ];

  assert.deepEqual(
    calculateStandings({ ...config, tieBreaker: ['head-to-head'] }, schedule).map(({ team, points }) => [team, points]),
    [
      ['a', 5],
      ['b', 5],
      ['c', 2],
    ],
  );
});

test.fails('ranks A first in a three-team tie when A has a positive margin against both opponents', () => {
  const schedule = [
    { id: 'j01', games: [{ home: { slug: 'b', score: 72 }, away: { slug: 'c', score: 70 } }] },
    { id: 'j02', games: [{ home: { slug: 'b', score: 60 }, away: { slug: 'a', score: 70 } }] },
    { id: 'j03', games: [{ home: { slug: 'a', score: 76 }, away: { slug: 'c', score: 70 } }] },
    { id: 'j04', games: [{ home: { slug: 'c', score: 71 }, away: { slug: 'b', score: 70 } }] },
    { id: 'j05', games: [{ home: { slug: 'a', score: 69 }, away: { slug: 'b', score: 70 } }] },
    { id: 'j06', games: [{ home: { slug: 'c', score: 71 }, away: { slug: 'a', score: 70 } }] },
  ];

  const standings = calculateStandings({ ...config, tieBreaker: ['head-to-head'] }, schedule);
  assert.deepEqual(
    standings.map(({ wins, points }) => ({ wins, points })),
    [
      { wins: 2, points: 6 },
      { wins: 2, points: 6 },
      { wins: 2, points: 6 },
    ],
  );
  assert.equal(standings[0].team, 'a');
});
