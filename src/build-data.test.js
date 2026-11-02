'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { buildSide, fromSearch, fromScoreFile } = require('./build-data');

const clubs = new Map([
  ['HOME CLUB', { slug: 'home', name: 'Home', logo: 'home.png' }],
  ['AWAY CLUB', { slug: 'away', name: 'Away', logo: null }],
]);

test('sides reference clubs without duplicating names or logos', () => {
  assert.deepEqual(buildSide(clubs, ' home club ', ' Team A ', 0),
    { club: 'home', team: 'Team A', score: 0 });
  assert.deepEqual(buildSide(clubs, null, 'AWAY CLUB', null),
    { club: 'away', team: 'AWAY CLUB', score: null });
  assert.throws(() => buildSide(clubs, 'Unknown club', 'Team A', 10), /Club not found.*Unknown club/);
  assert.throws(() => buildSide(clubs, null, null, null), /missing name/);
});

test('search results preserve match data and use club references', () => {
  const game = fromSearch({ slug: 'game', date: '2026-09-20' }, {
    Fecha: '21/09/2026', Hora: '11:30:00', Categoria: ' Cadete ', Estado: 'Terminado',
    NombreClubLocal: 'HOME CLUB', NombreClubVisitante: 'AWAY CLUB',
    NombreEquipoLocal: 'Team A', NombreEquipoVisitante: 'Team B',
    Resultados: { ResultadoLocal: '80', ResultadoVisitante: '70' },
  }, clubs);
  assert.deepEqual(game, {
    slug: 'game', date: '2026-09-21', time: '11:30', category: 'Cadete', played: true,
    home: { club: 'home', team: 'Team A', score: 80 },
    away: { club: 'away', team: 'Team B', score: 70 },
  });
});

test('score files resolve source aliases or fail rather than emitting null clubs', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gen11-build-data-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const file = path.join(directory, 'score.json');
  fs.writeFileSync(file, JSON.stringify({ partido: {
    local: 'HOME CLUB', visitante: 'AWAY CLUB',
    tanteo_local: '80', tanteo_visitante: '70', estado_partido: 'FINALIZADO',
  } }));
  const game = fromScoreFile({ slug: 'game', date: '2026-09-20' }, file, clubs);
  assert.deepEqual(game.home, { club: 'home', team: 'HOME CLUB', score: 80 });
  assert.deepEqual(game.away, { club: 'away', team: 'AWAY CLUB', score: 70 });
  assert.equal(game.played, true);
  assert.throws(() => fromScoreFile({ slug: 'game' }, null, clubs), /missing name/);
});

test('search metadata is combined with score files, preferring their scores', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gen11-build-data-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const file = path.join(directory, 'score.json');
  const entry = {
    Fecha: '21/09/2026', Hora: '11:30:00', Categoria: ' Cadete ',
    NombreClubLocal: 'HOME CLUB', NombreClubVisitante: 'AWAY CLUB',
    NombreEquipoLocal: 'Team A', NombreEquipoVisitante: 'Team B',
  };
  const game = { slug: 'game', date: '2026-09-20' };

  fs.writeFileSync(file, JSON.stringify({ partido: {
    tanteo_local: '80', tanteo_visitante: '70', estado_partido: 'FINALIZADO',
  } }));
  const expected = {
    slug: 'game', date: '2026-09-21', time: '11:30', category: 'Cadete', played: true,
    home: { club: 'home', team: 'Team A', score: 80 },
    away: { club: 'away', team: 'Team B', score: 70 },
  };
  assert.deepEqual(fromSearch(game, entry, clubs, file), expected);
  assert.deepEqual(fromSearch(game, {
    ...entry, Resultados: { ResultadoLocal: '10', ResultadoVisitante: '20' },
  }, clubs, file), expected);

  fs.writeFileSync(file, JSON.stringify({ partido: { tanteo_local: '0' } }));
  const partial = fromSearch(game, {
    ...entry, Resultados: { ResultadoLocal: '10', ResultadoVisitante: '20' },
  }, clubs, file);
  assert.equal(partial.home.score, 0);
  assert.equal(partial.away.score, 20);
  assert.equal(partial.played, true);

  fs.writeFileSync(file, JSON.stringify({ partido: { estado_partido: 'FINALIZADO' } }));
  const finalized = fromSearch(game, entry, clubs, file);
  assert.equal(finalized.played, true);
  assert.equal(finalized.home.score, null);
  assert.equal(finalized.away.score, null);

  fs.writeFileSync(file, JSON.stringify({}));
  const upcoming = fromSearch(game, entry, clubs, file);
  assert.equal(upcoming.played, false);
  assert.equal(upcoming.home.score, null);
  assert.equal(upcoming.away.score, null);
});
