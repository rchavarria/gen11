import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { buildGameDetail, buildSide, fromDatedGame } from './build-data.js';
import { fetchNextGames } from './core/next-games.js';

const require = createRequire(import.meta.url);

const clubs = new Map([
  ['HOME CLUB', { slug: 'home', name: 'Home', logo: 'home.png' }],
  ['AWAY CLUB', { slug: 'away', name: 'Away', logo: null }],
]);

const datedGame = {
  slug: 'game',
  id: 'ABC',
  date: '2026-09-21T09:30:00Z',
  category: ' Cadete ',
  homeClubName: 'HOME CLUB',
  awayClubName: 'AWAY CLUB',
  downloaded: false,
  scored: false,
};

const detailMetadata = {
  slug: 'game',
  id: 'ABC',
  date: '2026-09-21T09:30:00Z',
  category: ' Cadete ',
};

test('sides reference clubs without duplicating names, teams or logos', () => {
  assert.deepEqual(buildSide(clubs, ' home club ', 0), { club: 'home', score: 0 });
  assert.deepEqual(buildSide(clubs, 'AWAY CLUB', null), { club: 'away', score: null });
  assert.throws(() => buildSide(clubs, 'Unknown club', 10), /Club not found.*Unknown club/);
  assert.throws(() => buildSide(clubs, null, null), /missing name/);
});

test('dated games preserve UTC dates without scores', () => {
  assert.deepEqual(fromDatedGame(datedGame, clubs), {
    slug: 'game',
    date: '2026-09-21T09:30:00Z',
    venue: '',
    category: 'Cadete',
    played: false,
    home: { club: 'home', score: null },
    away: { club: 'away', score: null },
  });
  assert.equal(fromDatedGame({ ...datedGame, date: '2026-09-21T00:00:00Z' }, clubs).date, '2026-09-21T00:00:00Z');
  assert.equal(fromDatedGame({ ...datedGame, venue: 'ferrandiz' }, clubs).venue, 'ferrandiz');
});

test('scores and played status come only from score files', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gen11-build-data-'));
  t.onTestFinished(() => fs.rmSync(directory, { recursive: true }));
  const file = path.join(directory, 'score.json');

  fs.writeFileSync(
    file,
    JSON.stringify({
      partido: {
        tanteo_local: '80',
        tanteo_visitante: '70',
        estado_partido: 'FINALIZADO',
      },
    }),
  );
  assert.deepEqual(fromDatedGame(datedGame, clubs, file), {
    slug: 'game',
    date: '2026-09-21T09:30:00Z',
    venue: '',
    category: 'Cadete',
    played: true,
    home: { club: 'home', score: 80 },
    away: { club: 'away', score: 70 },
  });

  fs.writeFileSync(file, JSON.stringify({ partido: { tanteo_local: '0', tanteo_visitante: '20' } }));
  const complete = fromDatedGame(datedGame, clubs, file);
  assert.equal(complete.home.score, 0);
  assert.equal(complete.played, true);

  fs.writeFileSync(file, JSON.stringify({ partido: { tanteo_local: '0' } }));
  const partial = fromDatedGame(datedGame, clubs, file);
  assert.equal(partial.home.score, 0);
  assert.equal(partial.away.score, null);
  assert.equal(partial.played, false);

  fs.writeFileSync(file, JSON.stringify({ partido: { estado_partido: 'FINALIZADO' } }));
  const finalized = fromDatedGame(datedGame, clubs, file);
  assert.equal(finalized.played, true);
  assert.equal(finalized.home.score, null);
  assert.equal(finalized.away.score, null);

  fs.writeFileSync(file, JSON.stringify({}));
  assert.deepEqual(fromDatedGame(datedGame, clubs, file), fromDatedGame(datedGame, clubs));
});

test('game details omit source names and internal flags and sort numeric period scores including overtime', () => {
  const game = { ...datedGame, extra: 'preserved', homeClubName: ' home club ' };
  const scoreData = {
    partido: {
      tanteo_local: '85',
      tanteo_visitante: '80',
      estado_partido: 'EN JUEGO',
      periodos: [
        { periodo: 5, tanteo_periodo_local: '5', tanteo_periodo_visitante: '0' },
        { periodo: 2, tanteo_periodo_local: 20, tanteo_periodo_visitante: 15 },
        { periodo: 1, tanteo_periodo_local: 10, tanteo_periodo_visitante: 20 },
        { periodo: 4, tanteo_periodo_local: 30, tanteo_periodo_visitante: 20 },
        { periodo: 3, tanteo_periodo_local: 20, tanteo_periodo_visitante: 25 },
      ],
    },
  };
  const original = JSON.stringify(scoreData);
  const originalGame = JSON.stringify(game);
  assert.deepEqual(buildGameDetail(game, clubs, scoreData), {
    ...detailMetadata,
    extra: 'preserved',
    home: { slug: 'home', score: 85, quarterScores: [10, 20, 20, 30, 5], timelyScores: [] },
    away: { slug: 'away', score: 80, quarterScores: [20, 15, 25, 20, 0], timelyScores: [] },
  });
  assert.equal(JSON.stringify(scoreData), original);
  assert.equal(JSON.stringify(game), originalGame);
  assert.equal(game.home, undefined);
});

test('game details require both scores, accept zero and handle missing periods', () => {
  for (const scoreData of [
    undefined,
    {},
    { partido: { estado_partido: 'FINALIZADO' } },
    { partido: { tanteo_local: 0 } },
    { partido: { tanteo_local: 'invalid', tanteo_visitante: 20 } },
  ]) {
    assert.equal(buildGameDetail(datedGame, clubs, scoreData), null);
  }
  assert.deepEqual(
    buildGameDetail(datedGame, clubs, {
      partido: { tanteo_local: 0, tanteo_visitante: '20' },
    }),
    {
      ...detailMetadata,
      home: { slug: 'home', score: 0, quarterScores: [], timelyScores: [] },
      away: { slug: 'away', score: 20, quarterScores: [], timelyScores: [] },
    },
  );
});

test('game details reject unknown clubs', () => {
  const scoreData = { partido: { tanteo_local: 80, tanteo_visitante: 70 } };
  for (const field of ['homeClubName', 'awayClubName']) {
    assert.throws(
      () =>
        buildGameDetail(
          {
            ...datedGame,
            [field]: 'Unknown club',
          },
          clubs,
          scoreData,
        ),
      /Club not found.*Unknown club/,
    );
  }
});

test('calendar builds from dated games without legacy files, sorting and skipping incomplete entries', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gen11-calendar-'));
  t.onTestFinished(() => fs.rmSync(directory, { recursive: true }));
  fs.mkdirSync(path.join(directory, 'core'));
  fs.mkdirSync(path.join(directory, 'data'));
  for (const file of [
    'build-data.js',
    'core/config.js',
    'core/games.js',
    'core/dated-games.js',
    'core/dates.js',
    'core/files.js',
    'core/timely-scores.js',
    'core/validate.js',
    'core/format.js',
  ]) {
    fs.copyFileSync(path.join(import.meta.dirname, file), path.join(directory, file));
  }
  fs.writeFileSync(
    path.join(directory, 'data/clubs.json'),
    JSON.stringify([
      { slug: 'home', sourceNames: ['HOME CLUB'] },
      { slug: 'away', sourceNames: ['AWAY CLUB'] },
    ]),
  );
  const datedGamesFile = path.join(directory, 'dated-games.json');
  fs.writeFileSync(
    datedGamesFile,
    JSON.stringify({
      'dated-games': [
        { ...datedGame, slug: 'later', id: 'BCD', date: '2026-09-22T09:30:00Z' },
        datedGame,
        { ...datedGame, slug: 'earlier', id: 'CDE', date: '2026-09-21T06:00:00Z' },
        { ...datedGame, slug: '' },
        { ...datedGame, slug: 'invalid-id', id: '' },
      ],
    }),
  );
  const gamesScores = path.join(directory, 'scores/season');
  fs.mkdirSync(gamesScores, { recursive: true });
  fs.writeFileSync(
    path.join(gamesScores, 'game-ABC.json'),
    JSON.stringify({
      partido: { tanteo_local: '80', tanteo_visitante: '70', estado_partido: 'FINALIZADO', idlocal: 1, idvisitante: 2 },
      envivo: {
        historialacciones: [
          {
            accion_tipo: 'CANASTA-2P',
            equipo_id: 1,
            numero_periodo: 1,
            tiempo_partido: '00:09:00.0',
            dorsal: '5',
            informacion_adicional: '{"tanteoLocal":2,"tanteoVisitante":0}',
          },
        ],
      },
    }),
  );
  const { buildCalendar, buildGameFiles } = require(path.join(directory, 'build-data.js'));
  const config = {
    paths: {
      datedGamesFile,
      gamesScores: path.dirname(gamesScores),
    },
  };
  const sync = await fetchNextGames({
    config: { paths: { ...config.paths, nextGames: path.join(directory, 'next-games') } },
    getNextGames: async () => ({
      mispartidos: [{ IdPartido: 'CDE', Fecha: '21/09/2026', Hora: '09:00:00' }],
    }),
  });
  assert.equal(sync.updated[0].date, '2026-09-21T07:00:00Z');
  assert.deepEqual(await buildCalendar(config), { count: 3, skipped: ['(no slug)', 'invalid-id'] });
  const calendar = JSON.parse(fs.readFileSync(path.join(directory, 'data/calendar.json'), 'utf8'));
  assert.deepEqual(
    calendar.map((game) => game.slug),
    ['earlier', 'game', 'later'],
  );
  assert.deepEqual(calendar[1], fromDatedGame(datedGame, clubs, path.join(gamesScores, 'game-ABC.json')));
  assert.equal(calendar[0].played, false);
  assert.equal(calendar[2].played, false);

  const calendarFile = path.join(directory, 'data/calendar.json');
  fs.writeFileSync(
    calendarFile,
    JSON.stringify([...calendar].reverse().map((game) => ({ ...game, venue: `manual-${game.slug}`, time: '00:01' }))),
  );
  const datedGames = JSON.parse(fs.readFileSync(datedGamesFile, 'utf8'));
  datedGames['dated-games'].find((game) => game.slug === 'earlier').venue = 'manual-earlier';
  datedGames['dated-games'].find((game) => game.slug === 'later').venue = '';
  fs.writeFileSync(datedGamesFile, JSON.stringify(datedGames));

  await buildCalendar(config);
  const rebuilt = JSON.parse(fs.readFileSync(calendarFile, 'utf8'));
  assert.deepEqual(
    rebuilt.map(({ slug, venue, date }) => ({ slug, venue, date })),
    [
      { slug: 'earlier', venue: 'manual-earlier', date: '2026-09-21T07:00:00Z' },
      { slug: 'game', venue: '', date: '2026-09-21T09:30:00Z' },
      { slug: 'later', venue: '', date: '2026-09-22T09:30:00Z' },
    ],
  );
  await buildCalendar(config);
  assert.deepEqual(JSON.parse(fs.readFileSync(calendarFile, 'utf8')), rebuilt);

  fs.writeFileSync(
    path.join(gamesScores, 'earlier-CDE.json'),
    JSON.stringify({
      partido: { tanteo_local: 10 },
    }),
  );
  assert.deepEqual(await buildGameFiles(config), { count: 1, slugs: ['game'] });
  const gamesDir = path.join(directory, 'data/games');
  assert.deepEqual(fs.readdirSync(gamesDir), ['game.json']);
  const gameFile = path.join(gamesDir, 'game.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(gameFile, 'utf8')), {
    ...detailMetadata,
    home: {
      slug: 'home',
      score: 80,
      quarterScores: [],
      timelyScores: [
        { time: 0, score: 0, jersey: null },
        { time: 60000, score: 2, jersey: '5' },
      ],
    },
    away: {
      slug: 'away',
      score: 70,
      quarterScores: [],
      timelyScores: [{ time: 0, score: 0, jersey: null }],
    },
  });
  fs.writeFileSync(
    path.join(gamesScores, 'game-ABC.json'),
    JSON.stringify({
      partido: { tanteo_local: 81, tanteo_visitante: 70 },
    }),
  );
  assert.deepEqual(await buildGameFiles(config), { count: 1, slugs: ['game'] });
  const rewritten = fs.readFileSync(gameFile, 'utf8');
  assert.equal(JSON.parse(rewritten).home.score, 81);
  assert.deepEqual(JSON.parse(rewritten).home.timelyScores, []);
  assert.deepEqual(JSON.parse(rewritten).away.timelyScores, []);
  await buildGameFiles(config);
  assert.equal(fs.readFileSync(gameFile, 'utf8'), rewritten);
});
