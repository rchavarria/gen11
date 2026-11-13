import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, vi } from 'vitest';
import { ApiError } from './api-client.js';
import { isAfterGameSchedule, processGames as processDownloads } from './download.js';
import { DAYS, fetchNextGames, fetchNextGamesRenewingKey, mergeDatedGames } from './next-games.js';
import { buildReport } from './report.js';

test('mergeDatedGames adds mapped entries in date/time order and updates date, time and venue', () => {
  const known = {
    slug: 'existing',
    id: 'AA',
    date: '2026-11-05T11:00:00Z',
    category: 'Cat',
    homeClubName: 'Home',
    awayClubName: 'Away',
    downloaded: true,
    scored: true,
  };
  const games = [known];
  const { added, updated } = mergeDatedGames(games, [
    { IdPartido: 'AA', Fecha: '04/11/2026', Hora: '09:15:00', Categoria: 'new category' },
    {
      IdPartido: 'BB',
      Fecha: '03/11/2026',
      Hora: '08:30:00',
      Categoria: 'New Cat',
      NombreClubLocal: 'Local',
      NombreClubVisitante: 'Visitante',
    },
    { IdPartido: 'BB', Fecha: '03/11/2026', Hora: '08:30:00' },
    { IdPartido: '', Fecha: '01/11/2026' },
  ]);

  assert.deepEqual(added, [
    {
      slug: '',
      id: 'BB',
      date: '2026-11-03T07:30:00Z',
      venue: '',
      category: 'New Cat',
      homeClubName: 'Local',
      awayClubName: 'Visitante',
      downloaded: false,
    },
  ]);
  assert.deepEqual(updated, [known]);
  assert.deepEqual(known, {
    slug: 'existing',
    id: 'AA',
    date: '2026-11-04T08:15:00Z',
    category: 'Cat',
    homeClubName: 'Home',
    awayClubName: 'Away',
    downloaded: true,
    scored: true,
  });
  assert.deepEqual(
    games.map((game) => game.id),
    ['BB', 'AA'],
  );
});

test('mergeDatedGames resolves exact venue names and refreshes venues without other changes', () => {
  const known = { id: 'AA', date: '2026-11-05T11:00:00Z', venue: 'old', scored: true };
  const untouched = { id: 'BB', date: '2026-11-06T00:00:00Z', venue: 'old' };
  const games = [known, untouched];
  const venues = new Map([
    ['PABELLON CENTRAL', 'central'],
    ['LA CANALEJA, PABELLON PISTA 1-3', 'canaleja'],
  ]);
  const upcoming = [
    { IdPartido: 'AA', Fecha: '05/11/2026', Hora: '12:00:00', CampoJuego: 'PABELLON CENTRAL' },
    { IdPartido: 'CC', Fecha: '07/11/2026', CampoJuego: 'PABELLON CENTRAL' },
    { IdPartido: 'DD', Fecha: '08/11/2026', CampoJuego: 'LA CANALEJA, PABELLON PISTA 1' },
    { IdPartido: 'EE', Fecha: '09/11/2026', CampoJuego: 'LA CANALEJA, PABELLON PISTA 1' },
    { IdPartido: 'FF', Fecha: '10/11/2026' },
  ];
  const result = mergeDatedGames(games, upcoming, venues);
  assert.equal(known.venue, 'central');
  assert.equal(known.scored, true);
  assert.equal(untouched.venue, 'old');
  assert.deepEqual(result.updated, [known]);
  assert.deepEqual(
    result.added.map((game) => game.venue),
    ['central', '', '', ''],
  );
  assert.deepEqual(result.unmatchedVenues, ['LA CANALEJA, PABELLON PISTA 1', '(missing CampoJuego)']);
  assert.deepEqual(mergeDatedGames(games, upcoming, venues).updated, []);

  const unmatched = mergeDatedGames(games, [{ ...upcoming[0], CampoJuego: 'UNKNOWN' }], venues);
  assert.equal(known.venue, 'central');
  assert.deepEqual(unmatched.updated, []);
  assert.deepEqual(unmatched.unmatchedVenues, ['UNKNOWN']);

  const missing = mergeDatedGames(games, [{ ...upcoming[0], CampoJuego: '' }], venues);
  assert.equal(known.venue, 'central');
  assert.deepEqual(missing.updated, []);
  assert.deepEqual(missing.unmatchedVenues, ['(missing CampoJuego)']);
});

test.each(['pabellon central', ' PABELLON CENTRAL', 'PABELLON CENTRAL ', 'PABELLON  CENTRAL', 'PABELLÓN CENTRAL'])(
  'mergeDatedGames does not normalize venue names: "%s"',
  (name) => {
    const games = [];
    const result = mergeDatedGames(
      games,
      [{ IdPartido: 'AA', Fecha: '01/11/2026', CampoJuego: name }],
      new Map([['PABELLON CENTRAL', 'central']]),
    );
    assert.equal(games[0].venue, '');
    assert.deepEqual(result.unmatchedVenues, [name]);
  },
);

test('mergeDatedGames keeps existing date for invalid incoming dates and sorts invalid dates last', () => {
  const existing = { slug: '', id: 'AA', date: '2026-11-01T09:00:00Z' };
  const noDate = { slug: '', id: 'BB', date: '' };
  const games = [noDate, existing];
  const { updated, invalidDates } = mergeDatedGames(games, [
    { IdPartido: 'AA', Fecha: '31/02/2026', Hora: '11:00:00' },
    { IdPartido: 'CC', Fecha: '31/02/2026' },
  ]);
  assert.equal(existing.date, '2026-11-01T09:00:00Z');
  assert.deepEqual(updated, []);
  assert.equal(invalidDates[0].id, 'CC');
  assert.deepEqual(
    games.map((game) => game.id),
    ['AA', 'BB'],
  );
});

test('mergeDatedGames updates the time and reports new games with invalid dates', () => {
  const game = { id: 'AA', date: '2026-11-06T09:00:00Z' };
  const games = [game];
  const result = mergeDatedGames(games, [
    { IdPartido: 'AA', Fecha: '06/11/2026', Hora: '12:30:00' },
    { IdPartido: 'BB', Fecha: '31/02/2026', NombreClubLocal: 'Home', NombreClubVisitante: 'Away' },
  ]);
  assert.equal(game.date, '2026-11-06T11:30:00Z');
  assert.deepEqual(result.updated, [game]);
  assert.equal(result.added.length, 0);
  assert.deepEqual(result.invalidDates, [{ id: 'BB', home: 'Home', away: 'Away', fecha: '31/02/2026', hora: '' }]);
});

test('fetchNextGames saves raw responses and consolidates dated-games.json', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-next-games-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const nextGames = path.join(dir, 'next-games');
  const datedGamesFile = path.join(dir, 'dated-games.json');
  let response = {
    mispartidos: [
      { IdPartido: 'AA', Fecha: '05/11/2026', Hora: '11:00:00', NombreClubLocal: 'A' },
      {
        IdPartido: 'BB',
        Fecha: '06/11/2026',
        Hora: '12:00:00',
        Categoria: 'Cat',
        NombreClubLocal: 'Home',
        NombreClubVisitante: 'Away',
        CampoJuego: 'PEDRO FERRANDIZ, PABELLON',
      },
    ],
    resultado: 'correcto',
  };
  const client = {
    config: { paths: { nextGames, datedGamesFile } },
    getNextGames: async ({ days }) => {
      assert.equal(days, DAYS);
      return response;
    },
  };
  const first = await fetchNextGames(client, { date: new Date(2026, 10, 1) });
  assert.equal(first.total, 2);
  assert.equal(first.added.length, 2);
  const readDaily = async (name) => JSON.parse(await fs.readFile(path.join(nextGames, name), 'utf8'));
  const readDated = async () => JSON.parse(await fs.readFile(datedGamesFile, 'utf8'));
  assert.deepEqual(await readDaily('2026-11-01.json'), response);
  await assert.rejects(fs.access(path.join(nextGames, 'next-games.json')), { code: 'ENOENT' });
  assert.equal((await readDated())['dated-games'].length, 2);
  assert.equal((await readDated())['dated-games'].find((game) => game.id === 'BB').venue, 'ferrandiz');

  response = {
    mispartidos: [
      { IdPartido: 'BB', Fecha: '01/11/2026', Hora: '13:15:00', CampoJuego: 'REAL CANOE N.C.' },
      { IdPartido: 'CC', Fecha: '07/11/2026', Hora: '14:00:00' },
    ],
    resultado: 'correcto',
  };
  const second = await fetchNextGames(client, { date: new Date(2026, 10, 2) });
  assert.equal(second.total, 3);
  assert.equal(second.added.length, 1);
  assert.equal(second.updated.length, 1);
  assert.deepEqual(second.unmatchedVenues, ['(missing CampoJuego)']);
  assert.deepEqual(await readDaily('2026-11-02.json'), response);
  const dated = (await readDated())['dated-games'];
  assert.deepEqual(
    dated.map((game) => game.id),
    ['BB', 'AA', 'CC'],
  );
  assert.deepEqual(dated[0], {
    slug: '',
    id: 'BB',
    date: '2026-11-01T12:15:00Z',
    venue: 'canoe',
    category: 'Cat',
    homeClubName: 'Home',
    awayClubName: 'Away',
    downloaded: false,
  });
});

test('fetchNextGames rejects invalid dated-games.json without overwriting it', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-next-games-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const client = {
    config: { paths: { nextGames: path.join(dir, 'next-games'), datedGamesFile: path.join(dir, 'dated-games.json') } },
    getNextGames: async () => ({ mispartidos: [] }),
  };
  for (const content of [
    'invalid JSON',
    '{}',
    '[]',
    '{"dated-games":[{"date":"2026-11-01","time":"10:00:00"}]}',
    '{"dated-games":[{"date":"2026-11-01"}]}',
  ]) {
    await fs.writeFile(client.config.paths.datedGamesFile, content);
    await assert.rejects(fetchNextGames(client));
    assert.equal(await fs.readFile(client.config.paths.datedGamesFile, 'utf8'), content);
  }
});

test('fetchNextGamesRenewingKey skips renewal when the first request succeeds', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-next-games-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  let renewals = 0;
  const result = await fetchNextGamesRenewingKey(
    {
      config: {
        paths: { nextGames: path.join(dir, 'next-games'), datedGamesFile: path.join(dir, 'dated-games.json') },
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
      paths: { nextGames: path.join(dir, 'next-games'), datedGamesFile: path.join(dir, 'dated-games.json') },
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
  await fs.writeFile(path.join(stats, 'older-BB.json'), '{}');
  await fs.writeFile(path.join(scores, 'older-BB.json'), '{}');
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

test('buildReport lists sections, empty ones and the error', () => {
  const text = buildReport({
    startedAt: new Date(2026, 10, 1, 10),
    finishedAt: new Date(2026, 10, 1, 11),
    error: 'boom',
    keyRenewed: true,
    newGames: [{ id: 'BB', date: '2026-11-08T00:00:00Z', home: 'Home', away: 'Away' }],
    invalidDates: [{ id: 'CC', fecha: '31/02/2026', hora: '', home: 'Home', away: 'Away' }],
    pendingSlug: [],
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
  assert.match(text, /## Downloaded games \(1\)\n\n- game-1/);
  assert.match(text, /Games pending a slug \(edit dated-games\.json\)/);
  assert.match(text, /## Games pending a slug.*\(0\)\n\n_None\._/);
  assert.match(text, /Game files: 0 written\./);
});
