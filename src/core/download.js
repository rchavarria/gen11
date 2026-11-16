'use strict';

/**
 * Download logic shared by download-games.js and sync.js: stats and score of
 * the games of the competition trees (src/data/<competitionId>.json).
 * Files are saved as <id>.json.
 */

const fs = require('node:fs/promises');
const path = require('node:path');

const { isNoDataError } = require('./api-client');
const { shortWait } = require('./wait');
const { formatDuration, timestamp } = require('./format');
const { fileExists } = require('./validate');
const { buildFileName, saveStats, saveScore } = require('./files');
const { isValidGame } = require('./games');
const { isUtcIsoDateTime } = require('./dates');

const SEPARATOR = '-'.repeat(50);
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function applyScores(game, scoreData) {
  const score = (value) => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  };
  game.home ??= { name: '', score: null };
  game.away ??= { name: '', score: null };
  game.home.score = score(scoreData?.partido?.tanteo_local);
  game.away.score = score(scoreData?.partido?.tanteo_visitante);
}

/**
 * Returns true until strictly more than three hours after the game starts.
 * Accepts UTC ISO 8601 date-times. Missing or invalid values return false.
 * @param {unknown} value
 * @returns {boolean}
 */
function isAfterGameSchedule(value) {
  return isUtcIsoDateTime(value) && Date.now() <= Date.parse(value) + THREE_HOURS_MS;
}

/**
 * Downloads stats and scores of one game, sequentially.
 * Files already written are kept even if a later step fails.
 * @param {import('./api-client').ApiClient} client
 * @param {{id: string}} game
 * @param {{requestsSent: number}} state Shared state used to pause between requests.
 */
async function downloadGame(client, game, state) {
  if (state.requestsSent > 0) await shortWait();
  state.requestsSent += 1;
  const statsData = await client.getGameStats(game.id);
  await saveStats(game, statsData, client.config.paths.gamesStats);
  console.log(`Stats saved: ${buildFileName(game.id)}`);

  await shortWait();
  state.requestsSent += 1;
  const scoreData = await client.getGameScore(game.id);
  await saveScore(game, scoreData, client.config.paths.gamesScores);
  console.log(`Score saved: ${buildFileName(game.id)}`);
  return scoreData;
}

/**
 * Identifies games to download and updates the analysis counts in the summary.
 * @param {object[]} games
 * @param {(game: object) => string} label
 * @param {string} statsDir
 * @param {string} scoresDir
 * @param {{ignored: number, skipped: number, notPlayedYet: number, alreadyDownloaded: number, toDownload: number}} summary
 * @returns {Promise<object[]>}
 */
async function analyzeGames(games, label, summary, statsDir, scoresDir) {
  const toDownload = [];
  let partialDownloadError;

  for (const game of games) {
    if (!isValidGame(game)) {
      summary.ignored += 1;
      continue;
    }

    // Games already marked as downloaded are skipped without any check.
    if (game.downloaded === true) {
      summary.skipped += 1;
      continue;
    }

    // Wait until more than three hours have passed since the scheduled start.
    if (isAfterGameSchedule(game.date)) {
      summary.notPlayedYet += 1;
      continue;
    }

    const fileName = buildFileName(game.id);
    const hasStats = await fileExists(path.join(statsDir, fileName));
    const hasScore = await fileExists(path.join(scoresDir, fileName));

    if (hasStats && hasScore) {
      const scoreData = JSON.parse(await fs.readFile(path.join(scoresDir, fileName), 'utf8'));
      applyScores(game, scoreData);
      game.downloaded = true;
      summary.alreadyDownloaded += 1;
      continue;
    }

    if (hasStats !== hasScore) {
      const missing = hasStats ? scoresDir : statsDir;
      partialDownloadError ??= new Error(
        `Game "${label(game)}" is only partially downloaded: missing ${path.join(missing, fileName)}`,
      );
      continue;
    }

    toDownload.push(game);
  }

  summary.toDownload = toDownload.length;
  console.log(
    `To download: ${summary.toDownload} (skipped ${summary.skipped}, not played yet ${summary.notPlayedYet}, already downloaded ${summary.alreadyDownloaded}, ignored ${summary.ignored})`,
  );

  if (partialDownloadError) {
    partialDownloadError.summary = summary;
    throw partialDownloadError;
  }

  return toDownload;
}

/**
 * Downloads analyzed games and updates the download counts in the summary.
 * @param {import('./api-client').ApiClient} client
 * @param {object[]} games
 * @param {(game: object) => string} label
 * @param {{requestsSent: number}} state
 * @param {{notPlayed: number, newlyDownloaded: number, downloadedGames: string[], notPlayedGames: string[]}} summary
 * @returns {Promise<void>}
 */
async function downloadGames(client, games, label, state, summary) {
  for (let i = 0; i < games.length; i += 1) {
    const game = games[i];
    console.log(SEPARATOR);
    console.log(`Game: ${i + 1}/${games.length}`);
    console.log(`Name: ${label(game)}`);
    console.log(`Id: ${game.id}`);
    const started = new Date();
    try {
      const scoreData = await downloadGame(client, game, state);
      applyScores(game, scoreData);
    } catch (err) {
      if (isNoDataError(err)) {
        // Game not played yet: continue with the next one and retry next run.
        summary.notPlayed += 1;
        summary.notPlayedGames.push(label(game));
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
    summary.downloadedGames.push(label(game));
  }
}

/**
 * Processes games, first identifying downloads and then downloading them.
 * `summary.downloadedGames` and `summary.notPlayedGames` list the affected games
 * by label.
 * @param {import('./api-client').ApiClient} client
 * @param {object[]} games
 * @param {{requestsSent?: number}} [state] Pass requestsSent > 0 when a request
 *   was already sent, so the first download waits first.
 * @param {{label?: (game: object) => string}} [options] Label used in logs and
 *   summaries (defaults to the game id).
 */
async function processGames(client, games, state = { requestsSent: 0 }, { label = (game) => game.id } = {}) {
  const { gamesStats: statsDir, gamesScores: scoresDir } = client.config.paths;
  const summary = {
    skipped: 0,
    notPlayedYet: 0,
    alreadyDownloaded: 0,
    toDownload: 0,
    newlyDownloaded: 0,
    notPlayed: 0,
    ignored: 0,
    downloadedGames: [],
    notPlayedGames: [],
  };
  const toDownload = await analyzeGames(games, label, summary, statsDir, scoresDir);
  await downloadGames(client, toDownload, label, state, summary);
  return summary;
}

function printSummary(summary, elapsedMs) {
  console.log('');
  console.log('='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Skipped (marked as downloaded): ${summary.skipped}`);
  console.log(`Skipped (less than or exactly 3 hours since start): ${summary.notPlayedYet}`);
  console.log(`Already downloaded: ${summary.alreadyDownloaded}`);
  console.log(`To download: ${summary.toDownload}`);
  console.log(`Newly downloaded: ${summary.newlyDownloaded}`);
  console.log(`Not played ("sin datos"): ${summary.notPlayed}`);
  console.log(`Ignored (empty/invalid id): ${summary.ignored}`);
  console.log(`Total execution time: ${formatDuration(elapsedMs)}`);
  console.log('='.repeat(50));
}

module.exports = { applyScores, isAfterGameSchedule, downloadGame, processGames, printSummary };
