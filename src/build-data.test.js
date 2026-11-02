'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { buildSide, fromDatedGame } = require('./build-data');

const clubs = new Map([
  ['HOME CLUB', { slug: 'home', name: 'Home', logo: 'home.png' }],
  ['AWAY CLUB', { slug: 'away', name: 'Away', logo: null }],
]);

const datedGame = {
  slug: 'game', id: 'ABC', date: '2026-09-21', time: '11:30:00',
  category: ' Cadete ', homeClubName: 'HOME CLUB', awayClubName: 'AWAY CLUB',
  downloaded: false, scored: false,
};

test('sides reference clubs without duplicating names, teams or logos', () => {
  assert.deepEqual(buildSide(clubs, ' home club ', 0), { club: 'home', score: 0 });
  assert.deepEqual(buildSide(clubs, 'AWAY CLUB', null), { club: 'away', score: null });
  assert.throws(() => buildSide(clubs, 'Unknown club', 10), /Club not found.*Unknown club/);
  assert.throws(() => buildSide(clubs, null, null), /missing name/);
});

test('dated games preserve metadata without scores and normalize unknown times', () => {
  assert.deepEqual(fromDatedGame(datedGame, clubs), {
    slug: 'game', date: '2026-09-21', time: '11:30', category: 'Cadete', played: false,
    home: { club: 'home', score: null },
    away: { club: 'away', score: null },
  });
  for (const time of ['00:00:00', '', undefined]) {
    assert.equal(fromDatedGame({ ...datedGame, time }, clubs).time, null);
  }
});

test('scores and played status come only from score files', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gen11-build-data-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const file = path.join(directory, 'score.json');

  fs.writeFileSync(file, JSON.stringify({ partido: {
    tanteo_local: '80', tanteo_visitante: '70', estado_partido: 'FINALIZADO',
  } }));
  assert.deepEqual(fromDatedGame(datedGame, clubs, file), {
    slug: 'game', date: '2026-09-21', time: '11:30', category: 'Cadete', played: true,
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

test('calendar builds from dated games without legacy files, sorting and skipping incomplete entries', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gen11-calendar-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  fs.mkdirSync(path.join(directory, 'core'));
  fs.mkdirSync(path.join(directory, 'data'));
  for (const file of ['build-data.js', 'core/config.js', 'core/games.js', 'core/dated-games.js', 'core/files.js']) {
    fs.copyFileSync(path.join(__dirname, file), path.join(directory, file));
  }
  fs.writeFileSync(path.join(directory, 'data/clubs.json'), JSON.stringify([
    { slug: 'home', sourceNames: ['HOME CLUB'] },
    { slug: 'away', sourceNames: ['AWAY CLUB'] },
  ]));
  const datedGamesFile = path.join(directory, 'dated-games.json');
  fs.writeFileSync(datedGamesFile, JSON.stringify({ 'dated-games': [
    { ...datedGame, slug: 'later', id: 'BCD', date: '2026-09-22' },
    datedGame,
    { ...datedGame, slug: 'earlier', id: 'CDE', time: '09:00:00' },
    { ...datedGame, slug: '' },
    { ...datedGame, slug: 'invalid-id', id: '' },
  ] }));
  const gamesScores = path.join(directory, 'scores/season');
  fs.mkdirSync(gamesScores, { recursive: true });
  fs.writeFileSync(path.join(gamesScores, 'game-ABC.json'), JSON.stringify({
    partido: { tanteo_local: '80', tanteo_visitante: '70', estado_partido: 'FINALIZADO' },
  }));
  const { buildCalendar } = require(path.join(directory, 'build-data.js'));
  assert.deepEqual(await buildCalendar({ paths: {
    datedGamesFile, gamesScores: path.dirname(gamesScores),
  } }), { count: 3, skipped: ['(no slug)', 'invalid-id'] });
  const calendar = JSON.parse(fs.readFileSync(path.join(directory, 'data/calendar.json'), 'utf8'));
  assert.deepEqual(calendar.map((game) => game.slug), ['earlier', 'game', 'later']);
  assert.deepEqual(calendar[1], fromDatedGame(datedGame, clubs, path.join(gamesScores, 'game-ABC.json')));
  assert.equal(calendar[0].played, false);
  assert.equal(calendar[2].played, false);
});
