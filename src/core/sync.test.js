import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, vi } from 'vitest';
import { ApiError } from './api-client.js';
import { allGames, emptyTree, PENDING } from './competitions.js';
import { applyScores, isAfterGameSchedule, processGames as processDownloads } from './download.js';
import { DAYS, fetchNextGames, fetchNextGamesRenewingKey, mergeNextGames } from './next-games.js';
import { buildReport } from './report.js';

const competition = {
  id: 's67-c',
  season: 's67',
  category: 'Cat',
  phases: [{ id: 'f1', type: 'league', groups: [{ id: 'g1', teams: [] }] }],
};
const oldCompetition = { ...competition, id: 's56-c', season: 's56' };

function makeTrees({ placed = [], pending = [] } = {}) {
  const tree = emptyTree(competition);
  tree.phases[0].groups[0].rounds.push({ id: 'j01', games: placed });
  tree[PENDING].push(...pending);
  return [
    { competition: oldCompetition, tree: emptyTree(oldCompetition) },
    { competition, tree },
  ];
}

test('mergeNextGames adds new games to pending-games and updates placed games by id', () => {
  const known = {
    id: 'AA',
    date: '2026-11-05T11:00:00Z',
    home: { name: 'Home', score: 21 },
    away: { name: 'Away', score: 20 },
    downloaded: true,
  };
  const trees = makeTrees({ placed: [known] });
  const { added, updated, discarded, changed } = mergeNextGames(
    trees,
    [
      { IdPartido: 'AA', Fecha: '04/11/2026', Hora: '09:15:00', Categoria: 'new category' },
      {
        IdPartido: 'BB',
        Fecha: '03/11/2026',
        Hora: '08:30:00',
        Categoria: ' Cat ',
        NombreEquipoLocal: 'Local',
        NombreEquipoVisitante: 'Visitante',
        NombreClubLocal: 'Shared club',
        NombreClubVisitante: 'Shared club',
      },
      { IdPartido: 'BB', Fecha: '03/11/2026', Hora: '08:30:00' },
      { IdPartido: 'CC', Fecha: '03/11/2026', Categoria: 'Other', NombreEquipoLocal: 'X', NombreEquipoVisitante: 'Y' },
      { IdPartido: '', Fecha: '01/11/2026' },
    ],
    new Map(),
    's67',
    new Map([['LOCAL', { slug: 'local' }]]),
  );

  const newGame = {
    id: 'BB',
    date: '2026-11-03T07:30:00Z',
    venue: '',
    home: { slug: 'local', score: null },
    away: { name: 'Visitante', score: null },
    downloaded: false,
  };
  assert.deepEqual(added, [{ competition: 's67-c', game: newGame }]);
  assert.deepEqual(trees[1].tree[PENDING], [newGame]);
  assert.deepEqual(trees[0].tree[PENDING], []);
  assert.deepEqual(updated, [known]);
  assert.deepEqual(known, {
    id: 'AA',
    date: '2026-11-04T08:15:00Z',
    home: { name: 'Home', score: 21 },
    away: { name: 'Away', score: 20 },
    downloaded: true,
  });
  assert.deepEqual(discarded, [{ id: 'CC', date: '2026-11-03T00:00:00Z', home: 'X', away: 'Y', category: 'Other' }]);
  assert.deepEqual([...changed], [trees[1]]);
});

test.each(['Cat', 'Cat - ORO'])('mergeNextGames matches the base category of "%s"', (category) => {
  const trees = makeTrees();
  trees[1].competition = { ...competition, category };
  const { added, discarded } = mergeNextGames(
    trees,
    ['Cat', ' Cat - ORO ', 'Cat - PLATA/BRONCE', 'Cat - ORO extra'].map((Categoria, index) => ({
      IdPartido: `game-${index}`,
      Fecha: '03/11/2026',
      Categoria,
    })),
  );

  assert.deepEqual(
    added.map(({ competition, game }) => [competition, game.id]),
    [
      ['s67-c', 'game-0'],
      ['s67-c', 'game-1'],
      ['s67-c', 'game-2'],
    ],
  );
  assert.deepEqual(
    discarded.map(({ category }) => category),
    ['Cat - ORO extra'],
  );
});

test('mergeNextGames updates pending games and leaves unchanged trees untouched', () => {
  const pending = { id: 'AA', date: '2026-11-05T11:00:00Z', venue: '' };
  const placed = { id: 'BB', date: '2026-11-01T11:00:00Z', venue: '' };
  const trees = makeTrees({ placed: [placed], pending: [pending] });
  const result = mergeNextGames(trees, [{ IdPartido: 'AA', Fecha: '02/11/2026', Hora: '10:00:00' }]);
  assert.deepEqual(result.updated, [pending]);
  assert.equal(pending.date, '2026-11-02T09:00:00Z');
  assert.deepEqual(result.added, []);
  assert.deepEqual(
    allGames(trees[1].tree).map((game) => game.id),
    ['BB', 'AA'],
  );
  assert.equal(mergeNextGames(trees, [{ IdPartido: 'AA', Fecha: '02/11/2026', Hora: '10:00:00' }]).changed.size, 0);
});

test('mergeNextGames distinguishes teams of the same club and does not fall back to club names', () => {
  const trees = makeTrees();
  const teams = new Map([
    ['HOME A', { slug: 'home-a', club: 'Shared club' }],
    ['HOME B', { slug: 'home-b', club: 'Shared club' }],
  ]);
  const raw = {
    IdPartido: 'AA',
    Fecha: '03/11/2026',
    Categoria: 'Cat',
    NombreEquipoLocal: ' home a ',
    NombreEquipoVisitante: 'Home B',
    NombreClubLocal: 'Shared club',
    NombreClubVisitante: 'Shared club',
  };
  const { added } = mergeNextGames(
    trees,
    [raw, { ...raw, IdPartido: 'BB', NombreEquipoLocal: 'Unknown team' }],
    new Map(),
    's67',
    teams,
  );
  assert.deepEqual(added[0].game.home, { slug: 'home-a', score: null });
  assert.deepEqual(added[0].game.away, { slug: 'home-b', score: null });
  assert.deepEqual(added[1].game.home, { name: 'Unknown team', score: null });
});

test('mergeNextGames resolves exact venue names and refreshes venues without other changes', () => {
  const known = { id: 'AA', date: '2026-11-05T11:00:00Z', venue: 'old', downloaded: true };
  const untouched = { id: 'BB', date: '2026-11-06T00:00:00Z', venue: 'old' };
  const trees = makeTrees({ placed: [known, untouched] });
  const venues = new Map([
    ['PABELLON CENTRAL', 'central'],
    ['LA CANALEJA, PABELLON PISTA 1-3', 'canaleja'],
  ]);
  const upcoming = [
    { IdPartido: 'AA', Fecha: '05/11/2026', Hora: '12:00:00', CampoJuego: 'PABELLON CENTRAL' },
    { IdPartido: 'CC', Fecha: '07/11/2026', Categoria: 'Cat', CampoJuego: 'PABELLON CENTRAL' },
    { IdPartido: 'DD', Fecha: '08/11/2026', Categoria: 'Cat', CampoJuego: 'LA CANALEJA, PABELLON PISTA 1' },
    { IdPartido: 'EE', Fecha: '09/11/2026', Categoria: 'Cat', CampoJuego: 'LA CANALEJA, PABELLON PISTA 1' },
    { IdPartido: 'FF', Fecha: '10/11/2026', Categoria: 'Cat' },
  ];
  const result = mergeNextGames(trees, upcoming, venues);
  assert.equal(known.venue, 'central');
  assert.equal(known.downloaded, true);
  assert.equal(untouched.venue, 'old');
  assert.deepEqual(result.updated, [known]);
  assert.deepEqual(
    result.added.map(({ game }) => game.venue),
    ['central', '', '', ''],
  );
  assert.deepEqual(result.unmatchedVenues, ['LA CANALEJA, PABELLON PISTA 1', '(missing CampoJuego)']);
  assert.deepEqual(mergeNextGames(trees, upcoming, venues).updated, []);

  const unmatched = mergeNextGames(trees, [{ ...upcoming[0], CampoJuego: 'UNKNOWN' }], venues);
  assert.equal(known.venue, 'central');
  assert.deepEqual(unmatched.updated, []);
  assert.deepEqual(unmatched.unmatchedVenues, ['UNKNOWN']);

  const missing = mergeNextGames(trees, [{ ...upcoming[0], CampoJuego: '' }], venues);
  assert.equal(known.venue, 'central');
  assert.deepEqual(missing.updated, []);
  assert.deepEqual(missing.unmatchedVenues, ['(missing CampoJuego)']);
});

test.each(['pabellon central', ' PABELLON CENTRAL', 'PABELLON CENTRAL ', 'PABELLON  CENTRAL', 'PABELLÓN CENTRAL'])(
  'mergeNextGames does not normalize venue names: "%s"',
  (name) => {
    const trees = makeTrees();
    const result = mergeNextGames(
      trees,
      [{ IdPartido: 'AA', Fecha: '01/11/2026', Categoria: 'Cat', CampoJuego: name }],
      new Map([['PABELLON CENTRAL', 'central']]),
    );
    assert.equal(trees[1].tree[PENDING][0].venue, '');
    assert.deepEqual(result.unmatchedVenues, [name]);
  },
);

test('mergeNextGames keeps existing dates for invalid incoming dates and reports invalid new games', () => {
  const existing = { id: 'AA', date: '2026-11-01T09:00:00Z' };
  const trees = makeTrees({ placed: [existing] });
  const { updated, added, invalidDates } = mergeNextGames(trees, [
    { IdPartido: 'AA', Fecha: '31/02/2026', Hora: '11:00:00' },
    {
      IdPartido: 'BB',
      Fecha: '31/02/2026',
      Categoria: 'Cat',
      NombreEquipoLocal: 'Home',
      NombreEquipoVisitante: 'Away',
    },
  ]);
  assert.equal(existing.date, '2026-11-01T09:00:00Z');
  assert.deepEqual(updated, []);
  assert.deepEqual(added, []);
  assert.deepEqual(invalidDates, [{ id: 'BB', home: 'Home', away: 'Away', fecha: '31/02/2026', hora: '' }]);
});

async function tempDataDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-next-games-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const dataDir = path.join(dir, 'data');
  await fs.mkdir(dataDir);
  await fs.writeFile(
    path.join(dataDir, 'competitions.json'),
    JSON.stringify({ competitions: [oldCompetition, competition] }),
  );
  await fs.writeFile(
    path.join(dataDir, 'teams.json'),
    JSON.stringify([
      { slug: 'home', name: 'Home' },
      { slug: 'away', name: 'Away' },
    ]),
  );
  return { dir, dataDir };
}

test('fetchNextGames saves raw responses and writes only modified trees', async (t) => {
  const { dir, dataDir } = await tempDataDir(t);
  const nextGames = path.join(dir, 'next-games');
  let response = {
    mispartidos: [
      { IdPartido: 'AA', Fecha: '05/11/2026', Hora: '11:00:00', Categoria: 'Cat', NombreEquipoLocal: 'A' },
      {
        IdPartido: 'BB',
        Fecha: '06/11/2026',
        Hora: '12:00:00',
        Categoria: 'Cat',
        NombreEquipoLocal: 'Home',
        NombreEquipoVisitante: 'Away',
        CampoJuego: 'PEDRO FERRANDIZ, PABELLON',
      },
    ],
    resultado: 'correcto',
  };
  const client = {
    config: { paths: { nextGames } },
    getNextGames: async ({ days }) => {
      assert.equal(days, DAYS);
      return response;
    },
  };
  const first = await fetchNextGames(client, { date: new Date(2026, 10, 1), dataDir });
  assert.equal(first.total, 2);
  assert.equal(first.added.length, 2);
  const readDaily = async (name) => JSON.parse(await fs.readFile(path.join(nextGames, name), 'utf8'));
  const treeFile = path.join(dataDir, 's67-c.json');
  const readTree = async () => JSON.parse(await fs.readFile(treeFile, 'utf8'));
  assert.deepEqual(await readDaily('2026-11-01.json'), response);
  await assert.rejects(fs.access(path.join(dataDir, 's56-c.json')), { code: 'ENOENT' });
  assert.equal((await readTree())[PENDING].length, 2);
  assert.equal((await readTree())[PENDING].find((game) => game.id === 'BB').venue, 'ferrandiz');

  response = {
    mispartidos: [
      { IdPartido: 'BB', Fecha: '01/11/2026', Hora: '13:15:00', CampoJuego: 'REAL CANOE N.C.' },
      { IdPartido: 'CC', Fecha: '07/11/2026', Hora: '14:00:00', Categoria: 'Cat' },
      { IdPartido: 'DD', Fecha: '07/11/2026', Hora: '14:00:00', Categoria: 'Other' },
    ],
    resultado: 'correcto',
  };
  const second = await fetchNextGames(client, { date: new Date(2026, 10, 2), dataDir });
  assert.equal(second.total, 3);
  assert.equal(second.added.length, 1);
  assert.equal(second.updated.length, 1);
  assert.deepEqual(
    second.discarded.map((game) => game.id),
    ['DD'],
  );
  assert.deepEqual(second.unmatchedVenues, ['(missing CampoJuego)']);
  assert.deepEqual(await readDaily('2026-11-02.json'), response);
  const pending = (await readTree())[PENDING];
  assert.deepEqual(
    pending.map((game) => game.id),
    ['BB', 'AA', 'CC'],
  );
  assert.deepEqual(pending[0], {
    id: 'BB',
    date: '2026-11-01T12:15:00Z',
    venue: 'canoe',
    home: { slug: 'home', score: null },
    away: { slug: 'away', score: null },
    downloaded: false,
  });
  assert.deepEqual(pending[1].home, { name: 'A', score: null });
  assert.deepEqual(pending[2].home, { name: '', score: null });
  assert.deepEqual(pending[2].away, { name: '', score: null });
});

test('fetchNextGames rejects invalid trees without overwriting them', async (t) => {
  const { dir, dataDir } = await tempDataDir(t);
  const client = {
    config: { paths: { nextGames: path.join(dir, 'next-games') } },
    getNextGames: async () => ({ mispartidos: [{ IdPartido: 'AA', Fecha: '01/11/2026', Categoria: 'Cat' }] }),
  };
  const treeFile = path.join(dataDir, 's67-c.json');
  for (const content of [
    'invalid JSON',
    '{}',
    '[]',
    '{"phases":[],"pending-games":[{"id":"BB","date":"2026-11-01"}]}',
  ]) {
    await fs.writeFile(treeFile, content);
    await assert.rejects(fetchNextGames(client, { dataDir }));
    assert.equal(await fs.readFile(treeFile, 'utf8'), content);
  }
});

test('fetchNextGamesRenewingKey skips renewal when the first request succeeds', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-next-games-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  let renewals = 0;
  const result = await fetchNextGamesRenewingKey(
    {
      config: {
        paths: { nextGames: path.join(dir, 'next-games') },
      },
      getNextGames: async () => ({ mispartidos: [] }),
      renewKey: async () => {
        renewals += 1;
      },
    },
    { date: new Date(2026, 10, 1) },
    { wait: async () => {} },
  );
  assert.equal(renewals, 0);
  assert.equal(result.keyRenewed, false);
});

test('fetchNextGamesRenewingKey renews once on ApiError and retries', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-next-games-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  let calls = 0;
  let renewals = 0;
  let waits = 0;
  let renewalReported = false;
  const client = {
    config: {
      paths: { nextGames: path.join(dir, 'next-games') },
    },
    getNextGames: async () => {
      calls += 1;
      if (calls === 1) throw new ApiError('API error');
      return { mispartidos: [] };
    },
    renewKey: async () => {
      renewals += 1;
    },
  };
  const result = await fetchNextGamesRenewingKey(
    client,
    { date: new Date(2026, 10, 1) },
    {
      wait: async () => {
        waits += 1;
      },
      onKeyRenewed: () => {
        renewalReported = true;
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(renewals, 1);
  assert.equal(waits, 2);
  assert.equal(renewalReported, true);
  assert.equal(result.keyRenewed, true);
});

test('fetchNextGamesRenewingKey does not renew on non-API errors', async () => {
  const error = new Error('network error');
  let renewals = 0;
  await assert.rejects(
    fetchNextGamesRenewingKey(
      {
        getNextGames: async () => {
          throw error;
        },
        renewKey: async () => {
          renewals += 1;
        },
      },
      {},
      { wait: async () => {} },
    ),
    error,
  );
  assert.equal(renewals, 0);
});

test('fetchNextGamesRenewingKey reports renewal and propagates a second ApiError', async () => {
  const error = new ApiError('second API error');
  let renewals = 0;
  let waits = 0;
  let renewalReported = false;
  await assert.rejects(
    fetchNextGamesRenewingKey(
      {
        getNextGames: async () => {
          throw error;
        },
        renewKey: async () => {
          renewals += 1;
        },
      },
      {},
      {
        wait: async () => {
          waits += 1;
        },
        onKeyRenewed: () => {
          renewalReported = true;
        },
      },
    ),
    error,
  );
  assert.equal(renewals, 1);
  assert.equal(waits, 2);
  assert.equal(renewalReported, true);
});

test('download processing skips future games without adding a played field', async () => {
  const games = [
    {
      slug: 'future',
      id: 'AA',
      date: '2099-12-31T00:00:00Z',
      downloaded: false,
      scored: false,
    },
  ];
  const summary = await processDownloads(
    {
      config: { paths: { gamesStats: '/tmp/gen11-stats', gamesScores: '/tmp/gen11-scores' } },
    },
    games,
  );
  assert.equal(summary.notPlayedYet, 1);
  assert.equal(games[0].played, undefined);
  assert.equal(isAfterGameSchedule('2099-99-99'), false);
});

test('score updates preserve club identifiers, accept zero and use null for missing or invalid values', () => {
  const game = { home: { slug: 'home', score: 9 }, away: { name: 'Away', score: 8 } };
  applyScores(game, { partido: { tanteo_local: 0, tanteo_visitante: '72' } });
  assert.deepEqual(game, { home: { slug: 'home', score: 0 }, away: { name: 'Away', score: 72 } });
  applyScores(game, { partido: { tanteo_local: '12x', tanteo_visitante: null } });
  assert.equal(game.home.score, null);
  assert.equal(game.away.score, null);
  applyScores(game, {});
  assert.equal(game.home.score, null);
  assert.equal(game.away.score, null);
});

test('download processing applies scores from existing files', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-existing-scores-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const stats = path.join(dir, 'stats');
  const scores = path.join(dir, 'scores');
  await fs.mkdir(stats);
  await fs.mkdir(scores);
  await fs.writeFile(path.join(stats, 'AA.json'), '{}');
  await fs.writeFile(
    path.join(scores, 'AA.json'),
    JSON.stringify({ partido: { tanteo_local: 0, tanteo_visitante: 65 } }),
  );
  const game = { id: 'AA', home: { name: 'Home', score: null }, away: { name: 'Away', score: null } };

  const summary = await processDownloads({ config: { paths: { gamesStats: stats, gamesScores: scores } } }, [game]);

  assert.equal(summary.alreadyDownloaded, 1);
  assert.equal(game.downloaded, true);
  assert.deepEqual(game.home, { name: 'Home', score: 0 });
  assert.deepEqual(game.away, { name: 'Away', score: 65 });
});

test('download processing applies scores from a new download', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-new-scores-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const stats = path.join(dir, 'stats');
  const scores = path.join(dir, 'scores');
  const game = { id: 'AA', home: { name: 'Home', score: null }, away: { name: 'Away', score: null } };
  const response = { partido: { tanteo_local: 77, tanteo_visitante: 68 } };
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  try {
    const processing = processDownloads(
      {
        config: { paths: { gamesStats: stats, gamesScores: scores } },
        getGameStats: async () => ({}),
        getGameScore: async () => response,
      },
      [game],
    );
    for (let i = 0; i < 1000 && vi.getTimerCount() === 0; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(vi.getTimerCount(), 1);
    await vi.runAllTimersAsync();
    const summary = await processing;
    assert.equal(summary.newlyDownloaded, 1);
    assert.equal(game.downloaded, true);
    assert.deepEqual(game.home, { name: 'Home', score: 77 });
    assert.deepEqual(game.away, { name: 'Away', score: 68 });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(scores, 'AA.json'), 'utf8')), response);
  } finally {
    vi.useRealTimers();
  }
});

test('download progress counts only games that need downloading', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-download-progress-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const stats = path.join(dir, 'stats');
  const scores = path.join(dir, 'scores');
  await fs.mkdir(stats);
  await fs.mkdir(scores);
  await fs.writeFile(path.join(stats, 'CC.json'), '{}');
  await fs.writeFile(path.join(scores, 'CC.json'), '{}');

  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const summary = await processDownloads(
      {
        config: { paths: { gamesStats: stats, gamesScores: scores } },
        getGameStats: async () => {
          throw new ApiError('No data', { apiError: 'sin datos' });
        },
        getGameScore: vi.fn(),
      },
      [
        { slug: 'marked', id: 'AA', downloaded: true },
        { slug: 'future', id: 'BB', date: '2099-12-31T00:00:00Z' },
        { slug: 'existing', id: 'CC' },
        { slug: 'pending', id: 'DD' },
        { slug: 'invalid', id: 'XYZ' },
      ],
    );

    assert.equal(summary.toDownload, 1);
    assert.ok(
      log.mock.calls.some(
        ([line]) => line === 'To download: 1 (skipped 1, not played yet 1, already downloaded 1, ignored 1)',
      ),
    );
    assert.ok(log.mock.calls.some(([line]) => line === 'Game: 1/1'));
  } finally {
    log.mockRestore();
    warn.mockRestore();
  }
});

test('download analysis fails on partial files before making API requests', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-download-partial-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const stats = path.join(dir, 'stats');
  const scores = path.join(dir, 'scores');
  await fs.mkdir(stats);
  await fs.mkdir(scores);
  await fs.writeFile(path.join(stats, 'BB.json'), '{}');

  const getGameStats = vi.fn();
  const getGameScore = vi.fn();
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await assert.rejects(
      processDownloads(
        {
          config: { paths: { gamesStats: stats, gamesScores: scores } },
          getGameStats,
          getGameScore,
        },
        [
          { slug: 'pending', id: 'AA' },
          { slug: 'partial', id: 'BB' },
        ],
      ),
      (error) => {
        assert.match(error.message, /only partially downloaded/);
        assert.equal(error.summary.toDownload, 1);
        return true;
      },
    );
    assert.equal(getGameStats.mock.calls.length, 0);
    assert.equal(getGameScore.mock.calls.length, 0);
  } finally {
    log.mockRestore();
  }
});

test('download eligibility uses the UTC start and the strict three-hour boundary', () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-09T02:00:00Z'));
    assert.equal(isAfterGameSchedule('2026-11-09T03:00:00Z'), true);
    assert.equal(isAfterGameSchedule('2026-11-09T01:00:00Z'), true);
    assert.equal(isAfterGameSchedule('2026-11-08T23:00:00Z'), true);
    assert.equal(isAfterGameSchedule('2026-11-08T22:59:59Z'), false);
    assert.equal(isAfterGameSchedule('2026-11-09T00:00:00Z'), true);
    assert.equal(isAfterGameSchedule('invalid'), false);
    vi.setSystemTime(new Date('2026-11-09T03:00:00.001Z'));
    assert.equal(isAfterGameSchedule('2026-11-09T00:00:00Z'), false);
  } finally {
    vi.useRealTimers();
  }
});

test('download processing skips games at the boundary but processes older games', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-download-window-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const stats = path.join(dir, 'stats');
  const scores = path.join(dir, 'scores');
  await fs.mkdir(stats);
  await fs.mkdir(scores);
  await fs.writeFile(path.join(stats, 'BB.json'), '{}');
  await fs.writeFile(path.join(scores, 'BB.json'), '{}');
  const games = [
    { slug: 'boundary', id: 'AA', date: '2026-11-08T23:00:00Z' },
    { slug: 'older', id: 'BB', date: '2026-11-08T22:59:59Z' },
  ];
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-09T02:00:00Z'));
    const summary = await processDownloads({ config: { paths: { gamesStats: stats, gamesScores: scores } } }, games);
    assert.equal(summary.notPlayedYet, 1);
    assert.equal(summary.alreadyDownloaded, 1);
    assert.equal(games[0].downloaded, undefined);
    assert.equal(games[1].downloaded, true);
  } finally {
    vi.useRealTimers();
  }
});

test.each([
  ['2026-11-08T23:30:00Z', '9/11/26, 0:30'],
  ['2026-05-10T09:30:00Z', '10/5/26, 11:30'],
  ['2026-11-09T00:00:00Z', '2026-11-09'],
  [null, '(no date)'],
  ['2026-02-31T12:00:00Z', '(no date)'],
])('buildReport formats game date %s as %s', (date, expected) => {
  const text = buildReport({
    startedAt: new Date('2026-11-01T10:00:00Z'),
    finishedAt: new Date('2026-11-01T11:00:00Z'),
    newGames: [{ id: 'BB', date, home: 'Home', away: 'Away' }],
    pendingGames: [],
    downloaded: [],
    notPlayed: [],
  });
  assert.ok(text.includes(`- ${expected} — Home vs Away — \`BB\``));
});

test('buildReport lists sections, empty ones and the error', () => {
  const text = buildReport({
    startedAt: new Date(2026, 10, 1, 10),
    finishedAt: new Date(2026, 10, 1, 11),
    error: 'boom',
    keyRenewed: true,
    newGames: [{ id: 'BB', date: '2026-11-08T00:00:00Z', home: 'Home', away: 'Away' }],
    invalidDates: [{ id: 'CC', fecha: '31/02/2026', hora: '', home: 'Home', away: 'Away' }],
    pendingGames: [],
    discarded: [{ id: 'DD', date: '2026-11-09T00:00:00Z', home: 'X', away: 'Y', category: 'Other' }],
    downloaded: ['game-1'],
    notPlayed: [],
    calendarCount: null,
    gameFilesCount: 0,
  });
  assert.match(text, /# Sync report 2026-11-01/);
  assert.match(text, /Status: FAILED/);
  assert.match(text, /Key renewed: yes/);
  assert.match(text, /Error: boom/);
  assert.match(text, /## New games \(1\)\n\n- 2026-11-08 — Home vs Away/);
  assert.match(text, /## New games skipped due to invalid dates \(1\)[\s\S]*31\/02\/2026/);
  assert.match(
    text,
    /## New games discarded \(no competition for their category\) \(1\)\n\n- 2026-11-09 — X vs Y — `DD` — Other/,
  );
  assert.match(text, /## Downloaded games \(1\)\n\n- game-1/);
  assert.match(text, /## Games pending placement \(edit src\/data\/<competitionId>\.json\) \(0\)\n\n_None\._/);
  assert.match(text, /Game files: 0 written\./);
});

test('buildReport lists pending games with their competition', () => {
  const text = buildReport({
    startedAt: new Date(2026, 10, 1, 10),
    finishedAt: new Date(2026, 10, 1, 11),
    newGames: [],
    pendingGames: [{ competition: 's67-c', id: 'EE', date: '2026-11-08T00:00:00Z', home: 'Home', away: 'Away' }],
    downloaded: [],
    notPlayed: [],
  });
  assert.match(text, /## Games pending placement .* \(1\)\n\n- s67-c — 2026-11-08 — Home vs Away — `EE`/);
});
