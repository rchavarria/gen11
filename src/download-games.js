#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Synchronizes the downloaded data of the games listed in <outputDir>/games.json.
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
 *                  played yet), the game is marked with `played: false` and
 *                  processing continues with the next game. On any other
 *                  failure execution aborts, keeping any file already
 *                  downloaded.
 *
 * Games whose id is empty or not hexadecimal are ignored.
 * Games already marked with `downloaded: true` are skipped (no file checks,
 * no requests).
 * Games marked with `played: false` whose `date` ("YYYY-MM-DD" or ISO 8601)
 * is after today are skipped as well.
 * Requests are sent strictly sequentially, with a random pause between them
 * (shortWait() in src/core/wait.js: between 100 and 200 seconds).
 * <outputDir>/games.json is rewritten only when the whole process succeeds.
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
 *              project root. Contains games.json, games-stats/ and
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
const { readGamesFile, writeGamesFile } = require('./core/games');

async function main() {
  const startTime = Date.now();

  let config;
  let client;
  let data;
  try {
    config = loadConfig();
    client = new ApiClient(config);
    data = await readGamesFile(config);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Games file: ${config.paths.gamesFile}`);
  console.log(`Stats directory: ${config.paths.gamesStats}`);
  console.log(`Scores directory: ${config.paths.gamesScores}`);
  console.log(`Processing ${data.games.length} game(s).`);

  try {
    const summary = await processGames(client, data);
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
