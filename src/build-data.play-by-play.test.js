import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { buildGameDetail } from './build-data.js';
import { getPlayByPlay } from './core/play-by-play.js';

const clubs = new Map([
  ['HOME CLUB', { slug: 'home' }],
  ['AWAY CLUB', { slug: 'away' }],
]);
const game = {
  slug: 'game',
  id: 'ABC',
  home: { slug: 'home', score: 0 },
  away: { slug: 'away', score: 0 },
};
const match = { idlocal: 1, idvisitante: 2, local: 'Home', visitante: 'Away', tanteo_local: 7, tanteo_visitante: 3 };
const action = {
  autoincremental_id: '10',
  accion_tipo: 'ASISTENCIA',
  equipo_id: '1',
  numero_periodo: '2',
  tiempo_partido: '00:05:30.5',
  dorsal: '05',
  informacion_adicional: '',
};
const withActions = (...historialacciones) => ({ partido: match, envivo: { historialacciones } });

test('actions keep source order, raw clock and jersey, and resolve the team', () => {
  const data = withActions(
    { ...action, autoincremental_id: '3', equipo_id: '-1', accion_tipo: 'FINAL-PARTIDO', dorsal: '-1' },
    { ...action, autoincremental_id: '7', equipo_id: '2', dorsal: 'ENTRENADOR/A', accion_tipo: 'TBANQUILLO-C' },
    { ...action, autoincremental_id: '5', dorsal: '00' },
  );
  assert.deepEqual(getPlayByPlay(data), [
    { id: 3, quarter: 2, clock: '00:05:30.5', type: 'game-end', team: null, jersey: '-1' },
    { id: 7, quarter: 2, clock: '00:05:30.5', type: 'coach-technical-foul', team: 'away', jersey: 'ENTRENADOR/A' },
    { id: 5, quarter: 2, clock: '00:05:30.5', type: 'assist', team: 'home', jersey: '00' },
  ]);
});

test('only baskets include the score', () => {
  const basket = {
    ...action,
    accion_tipo: 'CANASTA-3P',
    informacion_adicional: '{"tanteoLocal":54,"tanteoVisitante":48}',
  };
  const foul = {
    ...action,
    accion_tipo: 'FALTA-COMETIDA',
    informacion_adicional: '{"JugadorEnPista":1,"TLAsociados":2}',
  };
  const [made, fouled] = getPlayByPlay(withActions(basket, foul));
  assert.deepEqual(made, {
    id: 10,
    quarter: 2,
    clock: '00:05:30.5',
    type: 'three-point-made',
    team: 'home',
    jersey: '05',
    homeScore: 54,
    awayScore: 48,
  });
  assert.equal('homeScore' in fouled, false);
});

test('both possession arrow sides map to the same type', () => {
  const types = getPlayByPlay(
    withActions(
      { ...action, accion_tipo: 'FLECHA-ALTERNANCIA-LOCAL' },
      { ...action, accion_tipo: 'FLECHA-ALTERNANCIA-VISITANTE', equipo_id: '2' },
    ),
  ).map(({ type, team }) => [type, team]);
  assert.deepEqual(types, [
    ['possession-arrow', 'home'],
    ['possession-arrow', 'away'],
  ]);
});

test('an unknown type, an unknown team or a basket without score throw', () => {
  assert.throws(
    () => getPlayByPlay(withActions({ ...action, accion_tipo: 'NUEVA' })),
    /accion_tipo desconocido: NUEVA/,
  );
  assert.throws(() => getPlayByPlay(withActions({ ...action, equipo_id: '99' })), /equipo_id/);
  assert.throws(() => getPlayByPlay(withActions({ ...action, accion_tipo: 'CANASTA-2P' })), /informacion_adicional/);
});

test('game details include playByPlay', () => {
  const detail = buildGameDetail(game, clubs, withActions(action));
  assert.equal(detail.playByPlay.length, 1);
  assert.equal(detail.playByPlay[0].type, 'assist');
});

test('invalid actions leave playByPlay empty and warn with the slug', (t) => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  t.onTestFinished(() => warn.mockRestore());
  const detail = buildGameDetail(game, clubs, withActions({ ...action, accion_tipo: 'NUEVA' }));
  assert.deepEqual(detail.playByPlay, []);
  assert.equal(detail.home.score, 7);
  assert.match(warn.mock.lastCall[0], /play-by-play for game:/);
});
