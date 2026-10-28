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

const path = require('node:path');

const { ApiClient, isNoDataError } = require('./core/api-client');
const { loadConfig } = require('./core/config');
const { shortWait } = require('./core/wait');
const { formatDuration, timestamp, toDayString } = require('./core/format');
const { fileExists } = require('./core/validate');
const { buildFileName, saveStats, saveScore } = require('./core/files');
const { isValidGame, readGamesFile, writeGamesFile } = require('./core/games');

// -----------------------------------------------------------------------------
// Global configuration
// -----------------------------------------------------------------------------

const SEPARATOR = '-'.repeat(50);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------


/**
 * Returns true when `value` is a valid date whose day is strictly after today.
 * Accepts "YYYY-MM-DD" or any ISO 8601 date-time. Missing or invalid values
 * return false.
 * @param {unknown} value
 * @returns {boolean}
 */
function isAfterToday(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const text = value.trim();
  let day;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    day = text;
  } else {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return false;
    day = toDayString(parsed);
  }
  return day > toDayString(new Date());
}

// -----------------------------------------------------------------------------
// Core logic
// -----------------------------------------------------------------------------


/**
 * Downloads stats and scores of one game, sequentially.
 * Files already written are kept even if a later step fails.
 * @param {ApiClient} client
 * @param {{slug: string, id: string}} game
 * @param {{requestsSent: number}} state Shared state used to pause between requests.
 */
async function downloadGame(client, game, state) {
  // saveStats / saveScore expect { title, id }.
  const target = { title: game.slug, id: game.id };

  if (state.requestsSent > 0) await shortWait();
  state.requestsSent += 1;
  const statsData = await client.getGameStats(target.id);
  await saveStats(target, statsData, client.config.paths.gamesStats);
  console.log(`Stats saved: ${buildFileName(target.title, target.id)}`);

  await shortWait();
  state.requestsSent += 1;
  const scoreData = await client.getGameScore(target.id);
  await saveScore(target, scoreData, client.config.paths.gamesScores);
  console.log(`Score saved: ${buildFileName(target.title, target.id)}`);
}


/**
 * Processes every game of the data object, mutating it in memory.
 * @param {ApiClient} client
 * @param {{games: object[]}} data
 * @returns {Promise<{skipped: number, notPlayedYet: number, alreadyDownloaded: number, newlyDownloaded: number, notPlayed: number, ignored: number}>}
 */
async function processGames(client, data) {
  const { gamesStats: statsDir, gamesScores: scoresDir } = client.config.paths;
  const summary = { skipped: 0, notPlayedYet: 0, alreadyDownloaded: 0, newlyDownloaded: 0, notPlayed: 0, ignored: 0 };
  const state = { requestsSent: 0 };
  const total = data.games.length;

  for (let i = 0; i < total; i += 1) {
    const game = data.games[i];

    if (!isValidGame(game)) {
      summary.ignored += 1;
      continue;
    }

    // Games already marked as downloaded are skipped without any check.
    if (game.downloaded === true) {
      summary.skipped += 1;
      continue;
    }

    // Games not played yet and scheduled after today are skipped too.
    if (game.played === false && isAfterToday(game.date)) {
      summary.notPlayedYet += 1;
      continue;
    }

    const fileName = buildFileName(game.slug, game.id);
    const hasStats = await fileExists(path.join(statsDir, fileName));
    const hasScore = await fileExists(path.join(scoresDir, fileName));

    if (hasStats && hasScore) {
      game.downloaded = true;
      summary.alreadyDownloaded += 1;
      continue;
    }

    if (hasStats !== hasScore) {
      const missing = hasStats ? scoresDir : statsDir;
      const error = new Error(`Game "${game.slug}" is only partially downloaded: missing ${path.join(missing, fileName)}`);
      error.summary = summary;
      throw error;
    }

    console.log(SEPARATOR);
    console.log(`Game: ${i + 1}/${total}`);
    console.log(`Slug: ${game.slug}`);
    console.log(`Id: ${game.id}`);
    const started = new Date();
    try {
      await downloadGame(client, game, state);
    } catch (err) {
      if (isNoDataError(err)) {
        // Game not played yet: flag it and continue with the next one.
        game.played = false;
        summary.notPlayed += 1;
        console.warn(`No data ("${err.apiError}"): game marked as played: false.`);
        console.log(SEPARATOR);
        continue;
      }
      console.error(`Failed: ${timestamp()} after ${formatDuration(Date.now() - started)}`);
      console.error(SEPARATOR);
      err.summary = summary;
      throw err;
    }
    console.log(`Duration: ${formatDuration(Date.now() - started)}`);
    console.log(SEPARATOR);

    delete game.played;
    game.downloaded = true;
    summary.newlyDownloaded += 1;
  }

  return summary;
}

function printSummary(summary, elapsedMs) {
  console.log('');
  console.log('='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Skipped (marked as downloaded): ${summary.skipped}`);
  console.log(`Skipped (played: false, date after today): ${summary.notPlayedYet}`);
  console.log(`Already downloaded: ${summary.alreadyDownloaded}`);
  console.log(`Newly downloaded: ${summary.newlyDownloaded}`);
  console.log(`Not played ("sin datos"): ${summary.notPlayed}`);
  console.log(`Ignored (empty/invalid id): ${summary.ignored}`);
  console.log(`Total execution time: ${formatDuration(elapsedMs)}`);
  console.log('='.repeat(50));
}

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
