#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Synchronizes the downloaded data of the games listed in <outputDir>/dated-games.json.
 * For every game with a valid id, it checks whether both of these files exist:
 *   1. <outputDir>/games-stats/<slug>-<id>.json
 *   2. <outputDir>/games-scores/<slug>-<id>.json
 *
 * - Both exist:    the game is marked with `downloaded: true`.
 * - Only one:      an error is printed and execution aborts.
 * - None exists:   stats and scores are downloaded
 *                  (ApiClient.getGameStats/getGameScore from
 *                  src/core/api-client.js, saveStats/saveScore from
 *                  src/core/files.js). On success the game is marked with
 *                  `downloaded: true`. If the API answers "sin datos" (game not
 *                  played yet), it is retried on the next run and processing
 *                  continues with the next game. On any other failure execution
 *                  aborts, keeping any file already downloaded.
 *
 * Games whose id is empty or not hexadecimal are ignored.
 * Games already marked with `downloaded: true` are skipped (no file checks,
 * no requests).
 * Games whose UTC `date` falls after today in Madrid are skipped.
 * Requests are sent strictly sequentially, with a random pause between them
 * (shortWait() in src/core/wait.js: between 100 and 200 seconds).
 * <outputDir>/dated-games.json is rewritten only when the whole process succeeds.
 *
 * The download logic lives in src/core/download.js (shared with sync.js).
 *
 * REQUIREMENTS
 * ------------
 * - Node.js >= 18 (native global `fetch`).
 * - No external dependencies.
 *
 * CONFIGURATION (config.json)
 * ---------------------------
 * Read and validated by src/core/config.js (copy config.example.json to config.json):
 * baseUrl      (required) Base URL of the API (e.g. "https://data.source").
 * deviceId     (required) Registered device id, sent as `id_dispositivo`.
 * key          (required) Key sent as `key`. Replaced by a key received in a
 *              stats or score response, if any (handled by ApiClient).
 * outputDir    (optional) Root download directory, resolved against the
 *              project root. Contains dated-games.json, games-stats/ and
 *              games-scores/.
 *
 * EXECUTION EXAMPLE
 * -----------------
 *   node src/download-games.js
 * =============================================================================
 */

'use strict';

const { ApiClient } = require('./core/api-client');
const { loadConfig } = require('./core/config');
const { processGames, printSummary } = require('./core/download');
const { readDatedGamesFile, writeDatedGamesFile } = require('./core/dated-games');

async function main() {
  const startTime = Date.now();

  let config;
  let client;
  let data;
  try {
    config = loadConfig();
    client = new ApiClient(config);
    data = await readDatedGamesFile(config);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Games file: ${config.paths.datedGamesFile}`);
  console.log(`Stats directory: ${config.paths.gamesStats}`);
  console.log(`Scores directory: ${config.paths.gamesScores}`);
  console.log(`Processing ${data['dated-games'].length} game(s).`);

  try {
    const summary = await processGames(client, data['dated-games']);
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
