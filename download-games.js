#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Synchronizes the downloaded data of the games listed in downloads/games.json.
 * For every game with a valid id, it checks whether both of these files exist:
 *   1. downloads/games-stats/<slug>-<id>.json
 *   2. downloads/games-scores/<slug>-<id>.json
 *
 * - Both exist:    the game is marked with `downloaded: true`.
 * - Only one:      an error is printed and execution aborts.
 * - None exists:   stats and scores are downloaded (reusing download-stats.js
 *                  and download-scores.js). On success the game is marked with
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
 * Requests are sent strictly sequentially, with a random pause between them.
 * downloads/games.json is rewritten only when the whole process succeeds.
 *
 * REQUIREMENTS
 * ------------
 * - Node.js >= 20.6 (native global `fetch` and the `--env-file` flag).
 * - No external dependencies.
 *
 * ENVIRONMENT VARIABLES
 * ---------------------
 * BASE_URL     (required) Base URL of the API (e.g. "https://data.source").
 * DEVICE_ID    (required) Registered device id, sent as `id_dispositivo`.
 * KEY          (required) Key sent as `key` in every request.
 *
 * EXECUTION EXAMPLE
 * -----------------
 *   node --env-file=.env download-games.js
 * =============================================================================
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { fetchStats, saveStats } = require('./download-stats');
const { fetchScore, saveScore, buildFileName } = require('./download-scores');

// -----------------------------------------------------------------------------
// Global configuration
// -----------------------------------------------------------------------------

const BASE_URL = (process.env.BASE_URL || '').trim();
const DEVICE_ID = (process.env.DEVICE_ID || '').trim();
const KEY = (process.env.KEY || '').trim();

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const GAMES_FILE = path.join(DOWNLOADS_DIR, 'games.json');
const STATS_DIR = path.join(DOWNLOADS_DIR, 'games-stats');
const SCORES_DIR = path.join(DOWNLOADS_DIR, 'games-scores');

const MIN_DELAY_MS = 100 * 1000;
const MAX_DELAY_MS = 200 * 1000;
const SEPARATOR = '-'.repeat(50);
const USAGE = 'Usage: node --env-file=.env download-games.js';
const NO_DATA_ERROR = 'sin datos';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return crypto.randomInt(minMs, maxMs + 1);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} (${ms} ms)`;
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Returns true when the game has a usable slug and a non-empty hexadecimal id.
 * @param {unknown} game
 * @returns {boolean}
 */
function isValidGame(game) {
  return (
    game !== null &&
    typeof game === 'object' &&
    typeof game.slug === 'string' &&
    game.slug.trim() !== '' &&
    typeof game.id === 'string' &&
    /^[0-9A-Fa-f]+$/.test(game.id.trim())
  );
}

/**
 * Returns the local calendar day of a date as "YYYY-MM-DD".
 * @param {Date} date
 * @returns {string}
 */
function toDayString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

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

/**
 * Returns true if the given file exists.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function waitBeforeNextRequest() {
  const delayMs = randomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
  const nextRequestAt = timestamp(new Date(Date.now() + delayMs));
  console.log(`Waiting ${formatDuration(delayMs)} before the next request (at ${nextRequestAt})...`);
  await sleep(delayMs);
}

// -----------------------------------------------------------------------------
// Core logic
// -----------------------------------------------------------------------------

/**
 * Reads and parses downloads/games.json.
 * @returns {Promise<{games: object[]}>}
 */
async function readGamesFile() {
  const raw = await fs.readFile(GAMES_FILE, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${GAMES_FILE}: ${err.message}`);
  }
  if (data === null || typeof data !== 'object' || !Array.isArray(data.games)) {
    throw new Error(`Invalid structure in ${GAMES_FILE}: "games" array is missing.`);
  }
  return data;
}

/**
 * Writes the (updated) games data back to downloads/games.json.
 * @param {object} data
 */
async function writeGamesFile(data) {
  await fs.writeFile(GAMES_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * Downloads stats and scores of one game, sequentially.
 * Files already written are kept even if a later step fails.
 * @param {{slug: string, id: string}} game
 * @param {{requestsSent: number}} state Shared state used to pause between requests.
 */
async function downloadGame(game, state) {
  // download-stats.js / download-scores.js expect { title, id }.
  const target = { title: game.slug, id: game.id };

  if (state.requestsSent > 0) await waitBeforeNextRequest();
  state.requestsSent += 1;
  const statsData = await fetchStats(target.id);
  await saveStats(target, statsData, STATS_DIR);
  console.log(`Stats saved: ${buildFileName(target.title, target.id)}`);

  await waitBeforeNextRequest();
  state.requestsSent += 1;
  const scoreData = await fetchScore(target.id);
  await saveScore(target, scoreData, SCORES_DIR);
  console.log(`Score saved: ${buildFileName(target.title, target.id)}`);
}

/**
 * Returns true when the error is the API "sin datos" (no data) error,
 * meaning the game has not been played yet.
 * @param {Error & {apiError?: unknown}} err
 * @returns {boolean}
 */
function isNoDataError(err) {
  return typeof err.apiError === 'string' && err.apiError.trim().toLowerCase() === NO_DATA_ERROR;
}

/**
 * Processes every game of the data object, mutating it in memory.
 * @param {{games: object[]}} data
 * @returns {Promise<{skipped: number, notPlayedYet: number, alreadyDownloaded: number, newlyDownloaded: number, notPlayed: number, ignored: number}>}
 */
async function processGames(data) {
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
    const hasStats = await fileExists(path.join(STATS_DIR, fileName));
    const hasScore = await fileExists(path.join(SCORES_DIR, fileName));

    if (hasStats && hasScore) {
      game.downloaded = true;
      summary.alreadyDownloaded += 1;
      continue;
    }

    if (hasStats !== hasScore) {
      const missing = hasStats ? SCORES_DIR : STATS_DIR;
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
      await downloadGame(game, state);
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

function validateEnvironment() {
  const missing = [];
  if (BASE_URL === '') missing.push('BASE_URL');
  if (DEVICE_ID === '') missing.push('DEVICE_ID');
  if (KEY === '') missing.push('KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
        `Define them in a .env file.\n${USAGE}`,
    );
  }

  try {
    new URL(BASE_URL);
  } catch {
    throw new Error(`Invalid BASE_URL environment variable: "${BASE_URL}"`);
  }
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

  let data;
  try {
    validateEnvironment();
    data = await readGamesFile();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Games file: ${GAMES_FILE}`);
  console.log(`Stats directory: ${STATS_DIR}`);
  console.log(`Scores directory: ${SCORES_DIR}`);
  console.log(`Processing ${data.games.length} game(s).`);

  try {
    const summary = await processGames(data);
    // Only persist the games file when everything succeeded.
    await writeGamesFile(data);
    console.log(`Games file updated: ${GAMES_FILE}`);
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

