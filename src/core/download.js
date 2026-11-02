'use strict';

/**
 * Download logic shared by download-games.js and sync.js: stats and score of
 * the games listed in <outputDir>/dated-games.json.
 */

const path = require('node:path');

const { isNoDataError } = require('./api-client');
const { shortWait } = require('./wait');
const { formatDuration, timestamp, toDayString } = require('./format');
const { fileExists } = require('./validate');
const { buildFileName, saveStats, saveScore } = require('./files');
const { isValidGame } = require('./games');

const SEPARATOR = '-'.repeat(50);

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
    const parsed = new Date(`${text}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) return false;
    day = text;
  } else {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return false;
    day = toDayString(parsed);
  }
  return day > toDayString(new Date());
}

/**
 * Downloads stats and scores of one game, sequentially.
 * Files already written are kept even if a later step fails.
 * @param {import('./api-client').ApiClient} client
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
 * `summary.downloadedSlugs` and `summary.notPlayedSlugs` list the affected games.
 * @param {import('./api-client').ApiClient} client
 * @param {{dated-games: object[]}} data
 * @param {{requestsSent?: number}} [state] Pass requestsSent > 0 when a request
 *   was already sent, so the first download waits first.
 */
async function processGames(client, games, state = { requestsSent: 0 }) {
  const { gamesStats: statsDir, gamesScores: scoresDir } = client.config.paths;
  const summary = {
    skipped: 0, notPlayedYet: 0, alreadyDownloaded: 0, newlyDownloaded: 0, notPlayed: 0, ignored: 0,
    downloadedSlugs: [], notPlayedSlugs: [],
  };
  const total = games.length;

  for (let i = 0; i < total; i += 1) {
    const game = games[i];

    if (!isValidGame(game)) {
      summary.ignored += 1;
      continue;
    }

    // Games already marked as downloaded are skipped without any check.
    if (game.downloaded === true) {
      summary.skipped += 1;
      continue;
    }

    // Games scheduled after today are never downloaded.
    if (isAfterToday(game.date)) {
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
        // Game not played yet: continue with the next one and retry next run.
        summary.notPlayed += 1;
        summary.notPlayedSlugs.push(game.slug);
        console.warn(`No data ("${err.apiError}"): game will be retried on the next run.`);
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

    game.downloaded = true;
    summary.newlyDownloaded += 1;
    summary.downloadedSlugs.push(game.slug);
  }

  return summary;
}

function printSummary(summary, elapsedMs) {
  console.log('');
  console.log('='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Skipped (marked as downloaded): ${summary.skipped}`);
  console.log(`Skipped (date after today): ${summary.notPlayedYet}`);
  console.log(`Already downloaded: ${summary.alreadyDownloaded}`);
  console.log(`Newly downloaded: ${summary.newlyDownloaded}`);
  console.log(`Not played ("sin datos"): ${summary.notPlayed}`);
  console.log(`Ignored (empty/invalid id): ${summary.ignored}`);
  console.log(`Total execution time: ${formatDuration(elapsedMs)}`);
  console.log('='.repeat(50));
}

module.exports = { isAfterToday, downloadGame, processGames, printSummary };
