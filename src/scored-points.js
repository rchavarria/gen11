#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Extracts scored points (CANASTA-1P, CANASTA-2P and CANASTA-3P) of the games
 * listed in <outputDir>/games.json. The output is a JSON object useful for
 * creating a timeline of scored points, ideally on the browser, generated with
 * three.js or similar libraries.
 *
 * For every game with a valid id and `downloaded: true`, it checks whether
 * <outputDir>/game-scored-points/<slug>-<id>.json exists:
 *
 * - Exists:        the game is marked with `scored: true`.
 * - Doesn't exist: the scored points are generated from
 *                  <outputDir>/games-scores/<slug>-<id>.json, saved to
 *                  <outputDir>/game-scored-points/<slug>-<id>.json and the
 *                  game is marked with `scored: true`.
 *
 * Games whose id is empty or not hexadecimal, or not marked with
 * `downloaded: true`, are ignored.
 * Games already marked with `scored: true` are skipped (no file checks).
 * On any error execution aborts and <outputDir>/games.json is NOT updated.
 *
 * CONFIGURATION (config.json)
 * ---------------------------
 * Read and validated by src/core/config.js (see download-games.js).
 *
 * EXECUTION EXAMPLE
 * -----------------
 *   node src/scored-points.js
 * =============================================================================
 */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const { loadConfig } = require('./core/config');
const { fileExists } = require('./core/validate');
const { buildFileName, writeJson } = require('./core/files');
const { isValidGame, readGamesFile, writeGamesFile } = require('./core/games');
const { formatDuration } = require('./core/format');

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
  const timeMs =
    (Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds)) * 1000 + Number(tenths) * 100;
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
  } catch (err) {
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

  const actions = data.envivo && data.envivo.historialacciones;
  if (!Array.isArray(actions)) {
    throw new Error('No se encontró el array envivo.historialacciones.');
  }

  return {
    home_team: data.partido && data.partido.local,
    away_team: data.partido && data.partido.visitante,
    actions: actions
      .filter((action) => action && SCORING_ACTION_TYPES.has(action.accion_tipo))
      .map((action) => ({
        timestamp: getActionTimeMs(action),
        jersey: action.dorsal,
        ...getActionScore(action),
      })),
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
 * Processes every game of the data object, mutating it in memory.
 * @param {ReturnType<typeof loadConfig>} config
 * @param {{games: object[]}} data
 * @returns {Promise<{skipped: number, alreadyScored: number, newlyScored: number, ignored: number}>}
 */
async function processGames(config, data) {
  const summary = { skipped: 0, alreadyScored: 0, newlyScored: 0, ignored: 0 };

  for (const game of data.games) {
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

async function main() {
  const startTime = Date.now();

  let config;
  let data;
  try {
    config = loadConfig();
    data = await readGamesFile(config);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Games file: ${config.paths.gamesFile}`);
  console.log(`Scores directory: ${config.paths.gamesScores}`);
  console.log(`Scored points directory: ${config.paths.gameScoredPoints}`);
  console.log(`Processing ${data.games.length} game(s).`);

  try {
    const summary = await processGames(config, data);
    // Only persist the games file when everything succeeded.
    await writeGamesFile(config, data);
    console.log(`Games file updated: ${config.paths.gamesFile}`);
    printSummary(summary, Date.now() - startTime);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error('Execution aborted. Games file NOT updated.');
    if (err.summary) {
      printSummary(err.summary, Date.now() - startTime);
    }
    process.exitCode = 1;
  }
}

main();



