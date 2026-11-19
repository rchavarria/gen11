import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { buildStandings } from './build-data.js';
import { writeJson } from './core/files.js';

const computed = { type: 'computed', winPoints: 3, lossPoints: 1, walkoverPoints: 0 };

function game(id, home, away, homeScore, awayScore) {
  return {
    id,
    date: '2026-10-04T10:00:00Z',
    home: { slug: home, score: homeScore },
    away: { slug: away, score: awayScore },
  };
}

function rounds(...games) {
  return [{ id: 'j01', games }];
}

async function fixture(t, phases, tree, previous) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-build-standings-'));
  t.onTestFinished(() => fs.rm(dataDir, { recursive: true, force: true }));
  await writeJson(dataDir, 'competitions.json', { competitions: [{ id: 'cup', phases }] });
  await writeJson(dataDir, 'cup.json', tree);
  if (previous) await writeJson(dataDir, 'standings.json', previous);
  return dataDir;
}

test('refreshes computed groups from their tree without changing manual standings or the tree', async (t) => {
  const manual = {
    id: 'manual',
    standings: [{ team: 'm', gamesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, points: 0 }],
  };
  const previous = {
    competitions: [
      { id: 'cup', phases: [{ id: 'league', groups: [{ id: 'g1', standings: [{ team: 'old' }] }] }, manual] },
      { id: 'archive', phases: [manual] },
    ],
  };
  const tree = {
    phases: [
      {
        id: 'league',
        groups: [
          { id: 'g1', rounds: rounds(game('AA', 'a', 'b', 70, 60), game('BB', 'b', 'a', null, 65)) },
          { id: 'g2', rounds: rounds(game('CC', 'c', 'd', 50, 60)) },
        ],
      },
      { id: 'manual', rounds: rounds(game('DD', 'm', 'n', 80, 60)) },
    ],
    'pending-games': [game('EE', 'b', 'a', 100, 50)],
  };
  const dataDir = await fixture(
    t,
    [
      { id: 'manual', standings: { type: 'manual' } },
      { id: 'league', standings: computed, groups: [{ id: 'g2' }, { id: 'g1' }] },
    ],
    tree,
    previous,
  );
  const treeFile = path.join(dataDir, 'cup.json');
  const originalTree = await fs.readFile(treeFile, 'utf8');

  await buildStandings({ dataDir });

  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'standings.json'), 'utf8')), {
    competitions: [
      {
        id: 'cup',
        phases: [
          {
            id: 'league',
            groups: [
              {
                id: 'g1',
                standings: [
                  { team: 'a', gamesPlayed: 1, wins: 1, losses: 0, pointsFor: 70, pointsAgainst: 60, points: 3 },
                  { team: 'b', gamesPlayed: 1, wins: 0, losses: 1, pointsFor: 60, pointsAgainst: 70, points: 1 },
                ],
              },
              {
                id: 'g2',
                standings: [
                  { team: 'd', gamesPlayed: 1, wins: 1, losses: 0, pointsFor: 60, pointsAgainst: 50, points: 3 },
                  { team: 'c', gamesPlayed: 1, wins: 0, losses: 1, pointsFor: 50, pointsAgainst: 60, points: 1 },
                ],
              },
            ],
          },
          manual,
        ],
      },
      { id: 'archive', phases: [manual] },
    ],
  });
  assert.equal(await fs.readFile(treeFile, 'utf8'), originalTree);
});

test('creates standings.json for a computed phase without groups', async (t) => {
  const dataDir = await fixture(t, [{ id: 'league', standings: computed }], {
    phases: [{ id: 'league', rounds: rounds(game('AA', 'a', 'b', 60, 70)) }],
    'pending-games': [],
  });

  await buildStandings({ dataDir });

  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'standings.json'), 'utf8')), {
    competitions: [
      {
        id: 'cup',
        phases: [
          {
            id: 'league',
            standings: [
              { team: 'b', gamesPlayed: 1, wins: 1, losses: 0, pointsFor: 70, pointsAgainst: 60, points: 3 },
              { team: 'a', gamesPlayed: 1, wins: 0, losses: 1, pointsFor: 60, pointsAgainst: 70, points: 1 },
            ],
          },
        ],
      },
    ],
  });
});
