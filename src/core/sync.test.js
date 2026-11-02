'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { mergeNewGames, mergeNextGamesList, fetchNextGames } = require('./next-games');
const { buildReport } = require('./report');

test('mergeNextGamesList replaces whole games by id and retains games not received', () => {
  const kept = { IdPartido: 'AA', Fecha: '01/11/2026' };
  const existing = [kept, { IdPartido: 'BB', old: true }];
  const replacement = { IdPartido: 'BB', Fecha: '02/11/2026' };
  const added = { IdPartido: 'CC', Fecha: '03/11/2026' };
  assert.deepEqual(mergeNextGamesList(existing, [
    { IdPartido: 'BB', outdated: true }, replacement, added, null, {},
  ]), [kept, replacement, added]);
  assert.equal(existing[1].old, true);
});

test('mergeNextGamesList sorts by parsed date and time, with invalid dates last', () => {
  const games = [
    { IdPartido: 'NOV', Fecha: '01/11/2026', Hora: '08:00:00' },
    { IdPartido: 'LATE', Fecha: '31/10/2026', Hora: '16:00:00' },
    { IdPartido: 'EARLY', Fecha: '31/10/2026', Hora: '09:00:00' },
    { IdPartido: 'MIDNIGHT', Fecha: '31/10/2026' },
    { IdPartido: 'TIE', Fecha: '31/10/2026', Hora: '09:00:00' },
    { IdPartido: 'Z', Fecha: '31/02/2026', Hora: '12:00:00' },
    { IdPartido: 'Y', Fecha: '01/10/2026', Hora: '25:00:00' },
    { IdPartido: 'X' },
  ];
  assert.deepEqual(mergeNextGamesList([], games).map((game) => game.IdPartido),
    ['MIDNIGHT', 'EARLY', 'TIE', 'LATE', 'NOV', 'X', 'Y', 'Z']);
});

test('fetchNextGames saves raw responses and creates and updates the accumulated file', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-next-games-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const nextGames = path.join(dir, 'next-games');
  let response = { mispartidos: [
    { IdPartido: 'AA', Fecha: '05/11/2026' },
    { IdPartido: 'BB', Fecha: '06/11/2026', old: true },
  ], resultado: 'correcto' };
  const client = {
    config: { paths: { nextGames } },
    getNextGames: async ({ days }) => {
      assert.equal(days, 21);
      return response;
    },
  };
  const first = await fetchNextGames(client, { date: new Date(2026, 10, 1) });
  assert.equal(first.mergedCount, 2);
  const read = async (name) => JSON.parse(await fs.readFile(path.join(nextGames, name), 'utf8'));
  assert.deepEqual(await read('2026-11-01.json'), response);
  assert.deepEqual(await read('next-games.json'), { mispartidos: response.mispartidos });

  response = { mispartidos: [
    { IdPartido: 'BB', Fecha: '01/11/2026', Hora: '13:15:00' },
    { IdPartido: 'CC', Fecha: '07/11/2026' },
  ], resultado: 'correcto' };
  const second = await fetchNextGames(client, { date: new Date(2026, 10, 2) });
  assert.equal(second.mergedCount, 3);
  assert.deepEqual(await read('2026-11-02.json'), response);
  assert.deepEqual(await read('next-games.json'), { mispartidos: [
    response.mispartidos[0], { IdPartido: 'AA', Fecha: '05/11/2026' }, response.mispartidos[1],
  ] });
});

test('fetchNextGames rejects a corrupt accumulated file without overwriting it', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen11-next-games-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const client = {
    config: { paths: { nextGames: dir } },
    getNextGames: async () => ({ mispartidos: [] }),
  };
  const file = path.join(dir, 'next-games.json');
  for (const content of ['invalid JSON', '{}']) {
    await fs.writeFile(file, content);
    await assert.rejects(fetchNextGames(client));
    assert.equal(await fs.readFile(file, 'utf8'), content);
  }
});

test('mergeNewGames adds only unknown ids, with empty slug and ISO date', () => {
  const data = { games: [{ slug: 'known', id: 'AA', date: '2026-11-01', downloaded: true }] };
  const added = mergeNewGames(data, [
    { IdPartido: 'AA', Fecha: '01/11/2026' },
    { IdPartido: 'BB', Fecha: '08/11/2026', NombreEquipoLocal: 'Home', NombreEquipoVisitante: 'Away' },
    { IdPartido: 'BB', Fecha: '08/11/2026' },
  ]);
  assert.deepEqual(added, [{ id: 'BB', date: '2026-11-08', home: 'Home', away: 'Away' }]);
  assert.equal(data.games.length, 2);
  assert.deepEqual(data.games[1], { slug: '', id: 'BB', date: '2026-11-08', downloaded: false, played: false });
});

test('buildReport lists sections, empty ones and the error', () => {
  const text = buildReport({
    startedAt: new Date(2026, 10, 1, 10), finishedAt: new Date(2026, 10, 1, 11),
    error: 'boom',
    newGames: [{ id: 'BB', date: '2026-11-08', home: 'Home', away: 'Away' }],
    pendingSlug: [], downloaded: ['game-1'], notPlayed: [], scored: [], calendarCount: null,
  });
  assert.match(text, /# Sync report 2026-11-01/);
  assert.match(text, /Status: FAILED/);
  assert.match(text, /Error: boom/);
  assert.match(text, /## New games \(1\)\n\n- 2026-11-08 — Home vs Away/);
  assert.match(text, /## Downloaded games \(1\)\n\n- game-1/);
  assert.match(text, /## Games pending a slug.*\(0\)\n\n_None\._/);
});
