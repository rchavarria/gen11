import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { buildGameDetail } from './build-data.js';
import { getTimelyScores } from './core/timely-scores.js';

const clubs = new Map([
  ['HOME CLUB', { slug: 'home' }],
  ['AWAY CLUB', { slug: 'away' }],
]);
const game = { slug: 'game', id: 'ABC', homeClubName: 'HOME CLUB', awayClubName: 'AWAY CLUB' };
const match = { idlocal: 1, idvisitante: 2, local: 'Home', visitante: 'Away', tanteo_local: 7, tanteo_visitante: 3 };
const basket = {
  accion_tipo: 'CANASTA-2P',
  equipo_id: '1',
  numero_periodo: 1,
  tiempo_partido: '00:09:27.0',
  dorsal: '05',
  informacion_adicional: '{"tanteoLocal":2,"tanteoVisitante":0}',
};

test('game details include ordered scoring actions per team, tied free throws and overtime', () => {
  const scoreData = {
    partido: { ...match, tanteo_visitante: 4 },
    envivo: {
      historialacciones: [
        {
          ...basket,
          numero_periodo: 6,
          tiempo_partido: '00:04:30.5',
          informacion_adicional: '{"tanteoLocal":7,"tanteoVisitante":4}',
        },
        {
          ...basket,
          numero_periodo: 5,
          tiempo_partido: '00:04:00.0',
          informacion_adicional: '{"tanteoLocal":5,"tanteoVisitante":4}',
        },
        {
          ...basket,
          accion_tipo: 'CANASTA-1P',
          tiempo_partido: '00:09:00.0',
          informacion_adicional: '{"tanteoLocal":3,"tanteoVisitante":3}',
        },
        basket,
        { accion_tipo: 'TIRO2-FALLADO' },
        null,
        {
          ...basket,
          accion_tipo: 'CANASTA-1P',
          tiempo_partido: '00:09:00.0',
          equipo_id: 2,
          dorsal: '7',
          informacion_adicional: '{"tanteoLocal":3,"tanteoVisitante":4}',
        },
        {
          ...basket,
          accion_tipo: 'CANASTA-3P',
          tiempo_partido: '00:09:00.0',
          equipo_id: 2,
          dorsal: '7',
          informacion_adicional: '{"tanteoLocal":2,"tanteoVisitante":3}',
        },
      ],
    },
  };
  const original = JSON.stringify(scoreData);
  const detail = buildGameDetail(game, clubs, scoreData);
  assert.deepEqual(detail.home.timelyScores, [
    { time: 0, score: 0, jersey: null },
    { time: 33000, score: 2, jersey: '05' },
    { time: 60000, score: 3, jersey: '05' },
    { time: 2460000, score: 5, jersey: '05' },
    { time: 2729500, score: 7, jersey: '05' },
  ]);
  assert.deepEqual(detail.away.timelyScores, [
    { time: 0, score: 0, jersey: null },
    { time: 60000, score: 3, jersey: '7' },
    { time: 60000, score: 4, jersey: '7' },
  ]);
  assert.equal(JSON.stringify(scoreData), original);
});

test('free throws at the same time are ordered by accumulated score', () => {
  const data = {
    partido: match,
    envivo: {
      historialacciones: [3, 1, 2].map((score) => ({
        ...basket,
        accion_tipo: 'CANASTA-1P',
        informacion_adicional: JSON.stringify({ tanteoLocal: score, tanteoVisitante: 0 }),
      })),
    },
  };
  assert.deepEqual(getTimelyScores(data), {
    home: [
      { time: 0, score: 0, jersey: null },
      { time: 33000, score: 1, jersey: '05' },
      { time: 33000, score: 2, jersey: '05' },
      { time: 33000, score: 3, jersey: '05' },
    ],
    away: [{ time: 0, score: 0, jersey: null }],
  });
});

test('a valid empty action history keeps only the initial points', () => {
  const detail = buildGameDetail(game, clubs, { partido: match, envivo: { historialacciones: [] } });
  assert.deepEqual(detail.home.timelyScores, [{ time: 0, score: 0, jersey: null }]);
  assert.deepEqual(detail.away.timelyScores, [{ time: 0, score: 0, jersey: null }]);
});

test('missing or invalid actions produce empty arrays for both teams and a warning with the slug', (t) => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  t.onTestFinished(() => warn.mockRestore());
  const cases = [
    { partido: match },
    { partido: match, envivo: { historialacciones: {} } },
    { partido: { ...match, idlocal: null }, envivo: { historialacciones: [] } },
    ...[
      { equipo_id: 99 },
      { numero_periodo: 0 },
      { tiempo_partido: 'invalid' },
      { informacion_adicional: 'invalid' },
      { informacion_adicional: '{}' },
    ].map((invalid) => ({
      partido: match,
      envivo: { historialacciones: [basket, { ...basket, ...invalid }] },
    })),
  ];
  for (const data of cases) {
    const detail = buildGameDetail(game, clubs, data);
    assert.deepEqual(detail.home.timelyScores, []);
    assert.deepEqual(detail.away.timelyScores, []);
    assert.equal(detail.home.score, 7);
    assert.equal(detail.away.score, 3);
    assert.match(warn.mock.lastCall[0], /game:/);
  }
  assert.equal(warn.mock.calls.length, cases.length);
});
