import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import {
  allGames,
  computeSlug,
  emptyTree,
  listGames,
  loadTeams,
  placedGames,
  readCompetitions,
  readCompetitionTree,
  readCompetitionTrees,
  sortTreeGames,
  teamSlug,
  writeCompetitionTree,
} from './competitions.js';

const competition = {
  id: 's67-kdt-oro',
  season: 's67',
  category: 'Cat',
  phases: [
    { id: 'f1', type: 'league', groups: [{ id: 'g1', teams: [] }] },
    { id: 'playoffs', type: 'knockout' },
  ],
};

const game = (id, date, extra = {}) => ({
  id,
  date,
  venue: '',
  home: { slug: 'home', score: 0 },
  away: { slug: 'away', score: 0 },
  downloaded: false,
  ...extra,
});

async function tempDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-competitions-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, 'competitions.json'), JSON.stringify({ competitions: [competition] }));
  await fs.writeFile(
    path.join(dir, 'teams.json'),
    JSON.stringify([
      { slug: 'home', name: 'HOME TEAM', club: 'SHARED CLUB' },
      { slug: 'away', name: 'AWAY TEAM', club: 'SHARED CLUB' },
      { slug: 'third', name: 'THIRD TEAM' },
    ]),
  );
  return dir;
}

test('the real competitions.json is valid', async () => {
  const competitions = await readCompetitions();
  assert.ok(competitions.some((item) => item.id === 's67-kdt-oro'));
});

test('missing tree files return an empty tree with phases and groups', async (t) => {
  const dir = await tempDir(t);
  assert.deepEqual(await readCompetitionTree(competition, dir), {
    phases: [
      { id: 'f1', groups: [{ id: 'g1', rounds: [] }] },
      { id: 'playoffs', rounds: [] },
    ],
    'pending-games': [],
  });
});

test('trees are written, read back and walked with positions', async (t) => {
  const dir = await tempDir(t);
  const tree = emptyTree(competition);
  const first = game('AA', '2026-10-04T10:00:00Z');
  const second = game('BB', '2027-05-01T10:00:00Z');
  const pending = game('CC', '2026-11-01T10:00:00Z');
  tree.phases[0].groups[0].rounds.push({ id: 'j01', games: [first] });
  tree.phases[1].rounds.push({ id: 'j1', games: [second] });
  tree['pending-games'].push(pending);
  await writeCompetitionTree(competition, tree, dir);

  const [{ tree: read }] = await readCompetitionTrees(dir);
  assert.deepEqual(read, tree);
  assert.deepEqual(placedGames(read), [
    { game: first, position: { phase: 'f1', group: 'g1', round: 'j01' } },
    { game: second, position: { phase: 'playoffs', round: 'j1' } },
  ]);
  assert.deepEqual(
    allGames(read).map(({ id }) => id),
    ['AA', 'BB', 'CC'],
  );

  const clubs = await loadTeams(dir);
  assert.equal(
    computeSlug('s67-kdt-oro', { phase: 'f1', group: 'g1', round: 'j01' }, first, clubs),
    's67-kdt-oro-f1-g1-j01-home-away',
  );
  assert.equal(
    computeSlug(
      's67-kdt-oro',
      { phase: 'playoffs', round: 'j1' },
      { ...second, home: { name: ' away team ', score: 0 } },
      clubs,
    ),
    's67-kdt-oro-playoffs-j1-away-away',
  );
  assert.throws(
    () => computeSlug('x', { phase: 'f1', round: 'j1' }, { ...first, away: { name: 'Unknown', score: 0 } }, clubs),
    /Team not found.*Unknown/,
  );
  assert.throws(
    () => computeSlug('x', { phase: 'f1', round: 'j1' }, { ...first, away: { slug: 'unknown', score: 0 } }, clubs),
    /Team not found.*unknown/,
  );
  assert.equal(
    computeSlug('x', { phase: 'f1', round: 'j1' }, { ...first, away: { slug: 'third' } }, clubs),
    'x-f1-j1-home-third',
  );
  assert.equal(listGames([{ competition, tree: read }], clubs)[2].label, 's67-kdt-oro pending: home vs away (CC)');
  assert.equal(
    listGames([{ competition, tree: read }], new Map())[0].label,
    's67-kdt-oro f1-g1-j01: home vs away (AA)',
  );
});

test('invalid trees are rejected', async (t) => {
  const dir = await tempDir(t);
  const file = path.join(dir, 's67-kdt-oro.json');
  for (const content of [
    'invalid JSON',
    '{}',
    '{"phases":[{"id":"f9","rounds":[]}],"pending-games":[]}',
    '{"phases":[{"id":"f1","groups":[{"id":"g9","rounds":[]}]}],"pending-games":[]}',
    '{"phases":[{"id":"f1","rounds":[]}],"pending-games":[]}',
    '{"phases":[{"id":"playoffs","rounds":[{"id":"","games":[]}]}],"pending-games":[]}',
    '{"phases":[],"pending-games":[{"id":"AA","date":"2026-10-04"}]}',
  ]) {
    await fs.writeFile(file, content);
    await assert.rejects(readCompetitionTree(competition, dir), /Invalid/);
  }
});

test('teams resolve by normalized team name, never by club or sourceNames', async (t) => {
  const dir = await tempDir(t);
  const teams = await loadTeams(dir);
  assert.equal(teamSlug(teams, ' home team '), 'home');
  assert.equal(teamSlug(teams, 'away team'), 'away');
  assert.equal(teamSlug(teams, 'SHARED CLUB'), null);
  assert.equal(teamSlug(teams, 'HOME'), null);
  assert.equal(teamSlug(teams, undefined), null);
});

test('real competition participants and team lists reference the team catalog', async () => {
  const teams = await loadTeams();
  for (const { competition, tree } of await readCompetitionTrees()) {
    for (const phase of competition.phases) {
      for (const slug of [...(phase.teams || []), ...(phase.groups || []).flatMap((group) => group.teams)]) {
        assert.ok(teams.has(`\0${slug}`), `Unknown team ${slug} in ${competition.id}`);
      }
    }
    for (const { game, position } of placedGames(tree)) {
      assert.ok(computeSlug(competition.id, position, game, teams));
    }
  }
});

test('team catalog rejects invalid entries and duplicate names or slugs', async (t) => {
  const dir = await tempDir(t);
  const valid = { name: 'Home', slug: 'home', club: 'Club', sourceNames: ['OLD NAME'] };
  await fs.writeFile(path.join(dir, 'teams.json'), JSON.stringify([valid]));
  assert.equal(teamSlug(await loadTeams(dir), 'OLD NAME'), null);
  for (const data of [
    {},
    [null],
    [{ slug: 'home' }],
    [{ name: ' ', slug: 'home' }],
    [{ name: 'Home', slug: '' }],
    [{ name: 'Home', slug: '../home' }],
    [valid, { name: 'Away', slug: 'home' }],
    [valid, { name: ' home ', slug: 'away' }],
  ]) {
    await fs.writeFile(path.join(dir, 'teams.json'), JSON.stringify(data));
    await assert.rejects(loadTeams(dir), /Invalid|Duplicate/);
  }
});

test('sortTreeGames sorts rounds and pending games by date', () => {
  const tree = emptyTree(competition);
  tree.phases[1].rounds.push({
    id: 'j1',
    games: [game('B', '2026-10-05T00:00:00Z'), game('A', '2026-10-04T00:00:00Z')],
  });
  tree['pending-games'].push(game('D', '2026-10-05T00:00:00Z'), game('C', '2026-10-04T00:00:00Z'));
  sortTreeGames(tree);
  assert.deepEqual(
    allGames(tree).map(({ id }) => id),
    ['A', 'B', 'C', 'D'],
  );
});
