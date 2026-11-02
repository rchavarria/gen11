#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Extracts scored points (CANASTA-1P, CANASTA-2P and CANASTA-3P) of the games
 * listed in <outputDir>/dated-games.json. The output is a Chart.js 4 configuration
 * object ({type: 'line', data: {datasets}, options}) ready to render the score
 * evolution of a game in the browser.
 *
 * It contains two datasets: home team (red) and away team (blue). The scoring
 * team is identified comparing each action's `equipo_id` with
 * `partido.idlocal` / `partido.idvisitante`. Each dataset starts at
 * {x: 0, y: 0} and every point is {x, y, jersey}, where `x` is the elapsed
 * game time in ms, `y` the accumulated team score and `jersey` the scorer.
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
 * On any error execution aborts and <outputDir>/dated-games.json is NOT updated.
 *
 * The logic lives in src/core/scored-points.js (shared with sync.js).
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

const { loadConfig } = require('./core/config');
const { readDatedGamesFile, writeDatedGamesFile } = require('./core/dated-games');
const { processGames, printSummary } = require('./core/scored-points');

async function main() {
  const startTime = Date.now();

  let config;
  let data;
  try {
    config = loadConfig();
    data = await readDatedGamesFile(config);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Games file: ${config.paths.datedGamesFile}`);
  console.log(`Scores directory: ${config.paths.gamesScores}`);
  console.log(`Scored points directory: ${config.paths.gameScoredPoints}`);
  console.log(`Processing ${data['dated-games'].length} game(s).`);

  try {
    const summary = await processGames(config, data['dated-games']);
    // Only persist the games file when everything succeeded.
    await writeDatedGamesFile(config, data);
    console.log(`Games file updated: ${config.paths.datedGamesFile}`);
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
