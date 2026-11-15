import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildTrees } from './migrate-dated-games.js';

const competitions = [
  {
    id: 's67-c',
    season: 's67',
    category: 'Cat',
    phases: [{ id: 'f1', type: 'league', groups: [{ id: 'g1' }, { id: 'g2' }] }],
  },
  {
    id: 's56-c',
    season: 's56',
    category: 'Cat',
    phases: [
      { id: 'f1', type: 'league', groups: [{ id: 'g1' }] },
      { id: 'f3', type: 'league' },
    ],
  },
];

const clubs = new Map([
  ['HOME', { slug: 'real-madrid' }],
  ['AWAY', { slug: 'away' }],
]);

const dated = (slug, id, category = 'Cat') => ({
  slug,
  id,
  category,
  date: '2025-10-01T10:00:00Z',
  homeClubName: 'Home',
  awayClubName: 'Away',
});

test('buildTrees places games in any phase and group, and keeps the rest pending', () => {
  const { trees, pending, discarded } = buildTrees(
    [
      dated('s67-c-f1-g2-j02-real-madrid-away', 'A'),
      dated('s67-c-f1-g1-j01-madrid-away', 'B'),
      dated('s56-c-f3-j1-real-madrid-away', 'C'),
      dated('267-c-f1-g1-j08-madrid-away', 'D'),
      dated('s67-x-f1-g1-j01-madrid-away', 'E', 'Other'),
    ],
    competitions,
    clubs,
  );
  const current = trees.get('s67-c');
  assert.deepEqual(
    current.phases[0].groups[1].rounds.map((round) => [round.id, round.games.map((game) => game.id)]),
    [['j02', ['A']]],
  );
  assert.deepEqual(current.phases[0].groups[0].rounds[0].games[0].id, 'B');
  assert.deepEqual(trees.get('s56-c').phases[1].rounds[0].games[0].id, 'C');
  assert.deepEqual(
    pending.map((item) => [item.competition, item.game.id]),
    [['s67-c', 'D']],
  );
  assert.deepEqual(
    current['pending-games'].map((game) => game.id),
    ['D'],
  );
  assert.deepEqual(
    discarded.map((game) => game.id),
    ['E'],
  );
});
