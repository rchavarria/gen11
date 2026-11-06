import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildGameDetail, toPlayers } from './build-data.js';

const clubs = new Map([
  ['HOME CLUB', { slug: 'home' }],
  ['AWAY CLUB', { slug: 'away' }],
]);

const game = { slug: 'game', id: 'ABC', homeClubName: 'HOME CLUB', awayClubName: 'AWAY CLUB' };
const scoreData = { partido: { tanteo_local: '80', tanteo_visitante: '70' } };

const rawPlayer = {
  nombre: 'DOE, JOHN', dorsal: '5', quintetotitular: true, milisegundos_jugados: 1000,
  canasta1p: 1, tiro1p: 2, canasta2p: 3, tiro2p: 4, canasta3p: 5, tiro3p: 6,
  rebotedefensivo: 7, reboteofensivo: 8, asistencias: 9, perdidas: 10, recuperaciones: 11,
  taponescometidos: 12, taponesrecibidos: 13, faltascometidas: 14, faltasrecibidas: 15,
  masMenos: -3, valoracion: 16,
};

test('players are mapped to the renamed fields and the totals row is excluded', () => {
  const players = toPlayers([rawPlayer, { nombre: 'TOTALES', dorsal: '' }]);
  assert.deepEqual(players, [{
    jersey: '5',
    msPlayed: 1000,
    starter: true,
    freeThrows: { made: 1, attempted: 2 },
    twoPointers: { made: 3, attempted: 4 },
    threePointers: { made: 5, attempted: 6 },
    rebounds: { defensive: 7, offensive: 8 },
    assists: 9,
    turnovers: 10,
    steals: 11,
    blocks: { made: 12, received: 13 },
    fouls: { committed: 14, received: 15 },
    plusMinus: -3,
    efficiency: 16,
  }]);
});

test('game details add players per side only when stats are available', () => {
  const stats = { estadisticas: {
    estadisticasequipolocal: [rawPlayer],
    estadisticasequipovisitante: [{ ...rawPlayer, dorsal: '7' }, { nombre: 'TOTALES' }],
  } };
  const detail = buildGameDetail(game, clubs, scoreData, stats);
  assert.equal(detail.home.players.length, 1);
  assert.equal(detail.home.players[0].jersey, '5');
  assert.equal(detail.away.players.length, 1);
  assert.equal(detail.away.players[0].jersey, '7');

  const without = buildGameDetail(game, clubs, scoreData, null);
  assert.equal('players' in without.home, false);
  assert.equal('players' in without.away, false);
});
