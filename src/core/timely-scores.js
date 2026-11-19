'use strict';

/**
 * Extracts score timeline data from the raw actions of a game.
 */

const { getActionScore, isHomeAction, readActions } = require('./actions');

const SCORING_ACTION_TYPES = new Set(['CANASTA-1P', 'CANASTA-2P', 'CANASTA-3P']);
const REGULAR_PERIODS = 4;
const PERIOD_MS = 10 * 60 * 1000;
const OVERTIME_MS = 5 * 60 * 1000;
/**
 * Returns the ms elapsed at the end of `period`: 10 minutes per regular
 * period (1-4) and 5 minutes per overtime (5+).
 * @param {number} period
 * @returns {number}
 */
function getPeriodEndMs(period) {
  if (period <= REGULAR_PERIODS) return period * PERIOD_MS;
  return REGULAR_PERIODS * PERIOD_MS + (period - REGULAR_PERIODS) * OVERTIME_MS;
}

/**
 * Returns the action time in ms: end of numero_periodo minus tiempo_partido.
 * @param {{numero_periodo: unknown, tiempo_partido: unknown}} action
 * @returns {number}
 */
function getActionTimeMs(action) {
  const period = Number(action.numero_periodo);
  if (!Number.isInteger(period) || period < 1) {
    throw new Error(`numero_periodo no válido: ${action.numero_periodo}`);
  }

  const time = action.tiempo_partido;
  const match = typeof time === 'string' && time.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d))?$/);
  if (!match) {
    throw new Error(`Formato de tiempo no válido: ${time}`);
  }

  const [, hours, minutes, seconds, tenths = '0'] = match;
  const timeMs = (Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds)) * 1000 + Number(tenths) * 100;
  return getPeriodEndMs(period) - timeMs;
}

function getScoringActions(data) {
  const { actions, homeId, awayId } = readActions(data);

  return (
    actions
      .filter((action) => action && SCORING_ACTION_TYPES.has(action.accion_tipo))
      .map((action) => {
        return {
          timestamp: getActionTimeMs(action),
          jersey: action.dorsal,
          isHome: isHomeAction(action, homeId, awayId),
          ...getActionScore(action),
        };
      })
      // Ascending by time; ties (e.g. free throws) ordered by total score.
      .sort((a, b) => a.timestamp - b.timestamp || a.home_score + a.away_score - (b.home_score + b.away_score))
  );
}

function getTimelyScores(data) {
  const actions = getScoringActions(data);
  const home = [{ time: 0, score: 0, jersey: null }];
  const away = [{ time: 0, score: 0, jersey: null }];
  for (const action of actions) {
    const points = action.isHome ? home : away;
    points.push({
      time: action.timestamp,
      score: action.isHome ? action.home_score : action.away_score,
      jersey: action.jersey,
    });
  }
  return { home, away };
}

module.exports = {
  getScoringActions,
  getTimelyScores,
};
