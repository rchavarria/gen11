import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { isAfterToday, processGames as processDownloads } from './download.js';
import { fetchNextGames, mergeDatedGames } from './next-games.js';
import { buildReport } from './report.js';

test('mergeDatedGames adds mapped entries in date/time order and updates only date and time', () => {
  const known = {
    slug: 'existing',
    id: 'AA',
    date: '2026-11-05',
    time: '12:00:00',
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
      date: '2026-11-03',
      time: '08:30:00',
      category: 'New Cat',
      homeClubName: 'Local',
      awayClubName: 'Visitante',
      downloaded: false,
      scored: false,
    },
  ]);
  assert.deepEqual(updated, [known]);
  assert.deepEqual(known, {
    slug: 'existing',
    id: 'AA',
    date: '2026-11-04',
    time: '09:15:00',
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

test('mergeDatedGames keeps existing date for invalid incoming dates and sorts invalid dates last', () => {
  const existing = { slug: '', id: 'AA', date: '2026-11-01', time: '10:00:00' };
  const noDate = { slug: '', id: 'BB', date: '', time: '' };
  const games = [noDate, existing];
  const { updated } = mergeDatedGames(games, [{ IdPartido: 'AA', Fecha: '31/02/2026', Hora: '11:00:00' }]);
  assert.equal(existing.date, '2026-11-01');
  assert.equal(existing.time, '11:00:00');
  assert.deepEqual(updated, [existing]);
  assert.deepEqual(
    games.map((game) => game.id),
    ['AA', 'BB'],
  );
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
      },
    ],
    resultado: 'correcto',
  };
  const client = {
    config: { paths: { nextGames, datedGamesFile } },
    getNextGames: async ({ days }) => {
      assert.equal(days, 21);
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

  response = {
    mispartidos: [
      { IdPartido: 'BB', Fecha: '01/11/2026', Hora: '13:15:00' },
      { IdPartido: 'CC', Fecha: '07/11/2026', Hora: '14:00:00' },
    ],
    resultado: 'correcto',
  };
  const second = await fetchNextGames(client, { date: new Date(2026, 10, 2) });
  assert.equal(second.total, 3);
  assert.equal(second.added.length, 1);
  assert.equal(second.updated.length, 1);
  assert.deepEqual(await readDaily('2026-11-02.json'), response);
  const dated = (await readDated())['dated-games'];
  assert.deepEqual(
    dated.map((game) => game.id),
    ['BB', 'AA', 'CC'],
  );
  assert.deepEqual(dated[0], {
    slug: '',
    id: 'BB',
    date: '2026-11-01',
    time: '13:15:00',
    category: 'Cat',
    homeClubName: 'Home',
    awayClubName: 'Away',
    downloaded: false,
    scored: false,
  });
});

test('fetchNextGames rejects invalid dated-games.json without overwriting it', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-next-games-'));
  t.onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  const client = {
    config: { paths: { nextGames: path.join(dir, 'next-games'), datedGamesFile: path.join(dir, 'dated-games.json') } },
    getNextGames: async () => ({ mispartidos: [] }),
  };
  for (const content of ['invalid JSON', '{}', '[]']) {
    await fs.writeFile(client.config.paths.datedGamesFile, content);
    await assert.rejects(fetchNextGames(client));
    assert.equal(await fs.readFile(client.config.paths.datedGamesFile, 'utf8'), content);
  }
});

test('download processing skips future games without adding a played field', async () => {
  const games = [
    {
      slug: 'future',
      id: 'AA',
      date: '2099-12-31',
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
  assert.equal(isAfterToday('2099-99-99'), false);
});

test('buildReport lists sections, empty ones and the error', () => {
  const text = buildReport({
    startedAt: new Date(2026, 10, 1, 10),
    finishedAt: new Date(2026, 10, 1, 11),
    error: 'boom',
    newGames: [{ id: 'BB', date: '2026-11-08', home: 'Home', away: 'Away' }],
    pendingSlug: [],
    downloaded: ['game-1'],
    notPlayed: [],
    scored: [],
    calendarCount: null,
    gameFilesCount: 0,
  });
  assert.match(text, /# Sync report 2026-11-01/);
  assert.match(text, /Status: FAILED/);
  assert.match(text, /Error: boom/);
  assert.match(text, /## New games \(1\)\n\n- 2026-11-08 — Home vs Away/);
  assert.match(text, /## Downloaded games \(1\)\n\n- game-1/);
  assert.match(text, /Games pending a slug \(edit dated-games\.json\)/);
  assert.match(text, /## Games pending a slug.*\(0\)\n\n_None\._/);
  assert.match(text, /Game files: 0 written\./);
});
