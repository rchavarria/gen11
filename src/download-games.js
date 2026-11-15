#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Synchronizes the downloaded data of the games of the competition trees
 * (src/data/<competitionId>.json), both placed and pending games.
 * For every game with a valid id, it checks whether both of these files exist:
 *   1. <outputDir>/games-stats/<id>.json
 *   2. <outputDir>/games-scores/<id>.json
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
 * Games are skipped until more than three hours after their UTC `date`.
 * Requests are sent strictly sequentially, with a random pause between them
 * (shortWait() in src/core/wait.js: between 100 and 200 seconds).
 * The competition trees are rewritten only when the whole process succeeds.
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
 *              project root. Contains games-stats/ and games-scores/.
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
const { listGames, loadClubs, readCompetitionTrees, writeCompetitionTree } = require('./core/competitions');

async function main() {
  const startTime = Date.now();

  let client;
  let trees;
  let entries;
  try {
    client = new ApiClient(loadConfig());
    trees = await readCompetitionTrees();
    entries = listGames(trees, await loadClubs());
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Competitions: ${trees.map(({ competition }) => competition.id).join(', ')}`);
  console.log(`Stats directory: ${client.config.paths.gamesStats}`);
  console.log(`Scores directory: ${client.config.paths.gamesScores}`);
  console.log(`Processing ${entries.length} game(s).`);

  const labels = new Map(entries.map((entry) => [entry.game, entry.label]));
  try {
    const summary = await processGames(
      client,
      entries.map((entry) => entry.game),
      undefined,
      { label: (game) => labels.get(game) },
    );
    // Only persist the trees when everything succeeded.
    for (const { competition, tree } of trees) await writeCompetitionTree(competition, tree);
    console.log('Competition trees updated.');
    printSummary(summary, Date.now() - startTime);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error('Execution aborted. Competition trees NOT updated.');
    if (err.summary) {
      printSummary(err.summary, Date.now() - startTime);
    }
    process.exitCode = 1;
  }
}

main();
