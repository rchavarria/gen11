'use strict';

/**
 * Scored points logic shared by scored-points.js and sync.js. See
 * scored-points.js for the description of the generated Chart.js file.
 */

const fs = require('node:fs/promises');
const path = require('node:path');

const { fileExists } = require('./validate');
const { buildFileName, writeJson } = require('./files');
const { isValidGame } = require('./games');
const { formatDuration } = require('./format');

const SCORING_ACTION_TYPES = new Set(['CANASTA-1P', 'CANASTA-2P', 'CANASTA-3P']);
const REGULAR_PERIODS = 4;
const PERIOD_MS = 10 * 60 * 1000;
const OVERTIME_MS = 5 * 60 * 1000;
const HOME_COLORS = { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.5)' };
const AWAY_COLORS = { border: 'rgb(54, 162, 235)', background: 'rgba(54, 162, 235, 0.5)' };

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

/**
 * Returns the score after the action, decoded from `informacion_adicional`.
 * @param {{informacion_adicional: unknown}} action
 * @returns {{home_score: number, away_score: number}}
 */
function getActionScore(action) {
  let info;
  try {
    info = JSON.parse(action.informacion_adicional);
  } catch {
    throw new Error(`informacion_adicional no válida: ${action.informacion_adicional}`);
  }
  if (!info || typeof info !== 'object' || info.tanteoLocal === undefined || info.tanteoVisitante === undefined) {
    throw new Error(`informacion_adicional sin tanteo: ${action.informacion_adicional}`);
  }
  return { home_score: info.tanteoLocal, away_score: info.tanteoVisitante };
}

function getScoredPoints(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('El JSON debe contener un objeto en la raíz.');
  }

  const actions = data.envivo?.historialacciones;
  if (!Array.isArray(actions)) {
    throw new Error('No se encontró el array envivo.historialacciones.');
  }

  const game = data.partido;
  if (!game || typeof game !== 'object') {
    throw new Error('No se encontró el objeto partido.');
  }
  if (game.idlocal == null || game.idvisitante == null) {
    throw new Error(`partido.idlocal / partido.idvisitante no válidos: ${game.idlocal} / ${game.idvisitante}`);
  }
  const homeId = Number(game.idlocal);
  const awayId = Number(game.idvisitante);

  const scoringActions = actions
    .filter((action) => action && SCORING_ACTION_TYPES.has(action.accion_tipo))
    .map((action) => {
      const teamId = Number(action.equipo_id);
      if (teamId !== homeId && teamId !== awayId) {
        throw new Error(`equipo_id no coincide con ningún equipo: ${action.equipo_id}`);
      }
      return {
        timestamp: getActionTimeMs(action),
        jersey: action.dorsal,
        isHome: teamId === homeId,
        ...getActionScore(action),
      };
    })
    // Ascending by time; ties (e.g. free throws) ordered by total score.
    .sort((a, b) => a.timestamp - b.timestamp || a.home_score + a.away_score - (b.home_score + b.away_score));

  const homeData = [{ x: 0, y: 0 }];
  const awayData = [{ x: 0, y: 0 }];
  for (const action of scoringActions) {
    if (action.isHome) {
      homeData.push({ x: action.timestamp, y: action.home_score, jersey: action.jersey });
    } else {
      awayData.push({ x: action.timestamp, y: action.away_score, jersey: action.jersey });
    }
  }

  return {
    type: 'line',
    data: {
      datasets: [buildDataset(game.local, HOME_COLORS, homeData), buildDataset(game.visitante, AWAY_COLORS, awayData)],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${game.local} vs ${game.visitante}`,
        },
      },
      scales: {
        x: {
          type: 'linear',
          display: true,
          title: { display: true, text: 'ms' },
        },
        y: {
          display: true,
          title: { display: true, text: 'puntos' },
        },
      },
    },
  };
}

/**
 * Builds a Chart.js 4 line dataset.
 * @param {string} label
 * @param {{border: string, background: string}} colors
 * @param {object[]} points
 */
function buildDataset(label, colors, points) {
  return {
    label,
    backgroundColor: colors.background,
    borderColor: colors.border,
    fill: false,
    tension: 0.4,
    data: points,
  };
}

/**
 * Generates and saves the scored points file of one game.
 * @param {ReturnType<typeof loadConfig>} config
 * @param {string} fileName
 */
async function generateScoredPoints(config, fileName) {
  const scorePath = path.join(config.paths.gamesScores, fileName);
  const raw = await fs.readFile(scorePath, 'utf8');
  let scoredPoints;
  try {
    scoredPoints = getScoredPoints(JSON.parse(raw));
  } catch (err) {
    throw new Error(`${scorePath}: ${err.message}`);
  }
  await writeJson(config.paths.gameScoredPoints, fileName, scoredPoints);
}

/**
 * Processes every game in the list, mutating it in memory.
 * @param {ReturnType<typeof loadConfig>} config
 * @param {object[]} games
 * @returns {Promise<{skipped: number, alreadyScored: number, newlyScored: number, ignored: number}>}
 */
async function processGames(config, games) {
  const summary = { skipped: 0, alreadyScored: 0, newlyScored: 0, ignored: 0, scoredSlugs: [] };

  for (const game of games) {
    if (!isValidGame(game) || game.downloaded !== true) {
      summary.ignored += 1;
      continue;
    }

    if (game.scored === true) {
      summary.skipped += 1;
      continue;
    }

    const fileName = buildFileName(game.slug, game.id);
    if (await fileExists(path.join(config.paths.gameScoredPoints, fileName))) {
      game.scored = true;
      summary.alreadyScored += 1;
      continue;
    }

    try {
      await generateScoredPoints(config, fileName);
    } catch (err) {
      err.summary = summary;
      throw err;
    }
    console.log(`Scored points saved: ${fileName}`);
    game.scored = true;
    summary.newlyScored += 1;
    summary.scoredSlugs.push(game.slug);
  }

  return summary;
}

function printSummary(summary, elapsedMs) {
  console.log('');
  console.log('='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Skipped (marked as scored): ${summary.skipped}`);
  console.log(`Already scored: ${summary.alreadyScored}`);
  console.log(`Newly scored: ${summary.newlyScored}`);
  console.log(`Ignored (invalid id / not downloaded): ${summary.ignored}`);
  console.log(`Total execution time: ${formatDuration(elapsedMs)}`);
  console.log('='.repeat(50));
}

module.exports = { getScoredPoints, generateScoredPoints, processGames, printSummary };
