'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mergeNewGames } = require('./next-games');
const { buildReport } = require('./report');

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
