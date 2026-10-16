#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Downloads the live score ("marcador") of a list of games from the data
 * source API and saves every complete JSON response to disk, one file per
 * game. Games are downloaded strictly sequentially (never in parallel), with
 * a random pause between 10 and 15 minutes between requests.
 * The `key` does not rotate for this endpoint: the same key (read from .env)
 * is used for every request.
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
 * OUTPUT_DIR   (optional) Directory where JSON files are written. Relative
 *              paths are resolved against the current working directory.
 *              Created automatically if it does not exist. Defaults to ".".
 * The script aborts if a required variable is missing or empty.
 *
 * CONFIGURATION VARIABLES (in source)
 * -----------------------------------
 * API_PATH            Endpoint path appended to BASE_URL ("/v2/envivo/partido.ashx").
 * GAMES               List of games to download: { title, id }.
 *                     `title` is used as-is in the file name.
 *                     `id` is the game id, sent as `id_partido`.
 * MIN_DELAY_MS        Minimum pause between requests (10 minutes).
 * MAX_DELAY_MS        Maximum pause between requests (15 minutes).
 * REQUEST_TIMEOUT_MS  Maximum time allowed for a single HTTP request.
 *
 * REQUEST FORMAT
 * --------------
 * Method:        POST
 * URL:           BASE_URL + API_PATH
 * Content-Type:  application/x-www-form-urlencoded
 * Body:          id_partido=<id>&id_dispositivo=<DEVICE_ID>&key=<KEY>
 *
 * NOTE: `id_dispositivo` and `key` may contain "=" characters. The data source
 * does NOT accept them percent-encoded ("%3D"), so they are appended raw.
 *
 * RESPONSE FORMAT
 * ---------------
 * {
 *   "resultado": "correcto",
 *   "partido": { ... },
 *   "envivo": { ... },
 *   "error": null | "" | "<error message>"
 * }
 *
 * FILE NAMING CONVENTION
 * ----------------------
 * <OUTPUT_DIR>/<title>-<id>.json
 *
 * ERROR HANDLING RULES
 * --------------------
 * No retries. Execution aborts immediately (exit code 1) on network errors,
 * HTTP errors, invalid JSON, invalid response structure, a non-empty `error`
 * field or a `resultado` other than "correcto". Missing environment variables
 * or an invalid GAMES list also abort execution.
 *
 * EXECUTION EXAMPLE
 * -----------------
 *   node --env-file=.env download-scores.js
 * =============================================================================
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

// -----------------------------------------------------------------------------
// Global configuration
// -----------------------------------------------------------------------------

const BASE_URL = (process.env.BASE_URL || '').trim();
const DEVICE_ID = (process.env.DEVICE_ID || '').trim();
const KEY = (process.env.KEY || '').trim();
const OUTPUT_DIR = (process.env.OUTPUT_DIR || '').trim() || '.';

const MIN_DELAY_MS = 10 * 60 * 1000;
const MAX_DELAY_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30 * 1000;
const SEPARATOR = '-'.repeat(50);
const USAGE = 'Usage: node --env-file=.env download-scores.js';

const API_PATH = '/v2/envivo/partido.ashx';

/** @type {{title: string, id: string}[]} */
const GAMES = [
  // { title: 'cadete-g1-f1', id: '300070006700750046004E006E00...' },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return crypto.randomInt(minMs, maxMs + 1);
}

function buildUrl() {
  const base = BASE_URL.replace(/\/+$/, '');
  const apiPath = API_PATH.startsWith('/') ? API_PATH : `/${API_PATH}`;
  return `${base}${apiPath}`;
}

/**
 * Builds the x-www-form-urlencoded request body.
 * `id_dispositivo` and `key` are appended raw because the data source
 * rejects their percent-encoded "=" characters.
 * @param {string} gameId
 * @returns {string}
 */
function buildRequestBody(gameId) {
  const params = new URLSearchParams({ id_partido: gameId });
  return `${params.toString()}&id_dispositivo=${DEVICE_ID}&key=${KEY}`;
}

/**
 * Returns the output file name for a game. The title is used as-is.
 * @param {string} title
 * @param {string} id
 * @returns {string}
 */
function buildFileName(title, id) {
  return `${title}-${id}.json`;
}

function resolveOutputDir() {
  return path.resolve(process.cwd(), OUTPUT_DIR);
}

function isEmptyValue(value) {
  if (value === null || value === undefined || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
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

// -----------------------------------------------------------------------------
// Core logic
// -----------------------------------------------------------------------------

/**
 * Sends the POST request for one game and returns the parsed, validated JSON.
 * @param {string} gameId
 * @returns {Promise<object>}
 */
async function fetchScore(gameId) {
  const url = buildUrl();
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildRequestBody(gameId),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err && err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
    throw new Error(`Network error while requesting ${url}: ${reason}`);
  }

  let rawBody;
  try {
    rawBody = await response.text();
  } catch (err) {
    throw new Error(`Network error while reading response body: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} ${response.statusText}. Body: ${rawBody.slice(0, 500)}`);
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (err) {
    throw new Error(`Invalid JSON response: ${err.message}. Body: ${rawBody.slice(0, 500)}`);
  }

  validateResponse(data);
  return data;
}

/**
 * Validates the structure and error fields of an API response.
 * @param {unknown} data
 */
function validateResponse(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid response: expected a JSON object.');
  }

  if ('error' in data && !isEmptyValue(data.error)) {
    throw new Error(`API returned an error: ${JSON.stringify(data.error)}`);
  }

  if ('resultado' in data && data.resultado !== 'correcto') {
    throw new Error(`API returned an unexpected resultado: ${JSON.stringify(data.resultado)}`);
  }

  if (data.partido === null || typeof data.partido !== 'object' || Array.isArray(data.partido)) {
    throw new Error('Invalid response: "partido" field is missing or is not an object.');
  }
}

/**
 * Saves the complete response of a game to disk.
 * @param {{title: string, id: string}} game
 * @param {object} responseData
 * @returns {Promise<string>} The generated file name.
 */
async function saveScore(game, responseData) {
  const fileName = buildFileName(game.title, game.id);
  const outputDir = resolveOutputDir();
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, fileName), `${JSON.stringify(responseData, null, 2)}\n`, 'utf8');
  return fileName;
}

function logGame(info) {
  const p = info.data.partido;
  console.log(SEPARATOR);
  console.log(`Game: ${info.index}/${info.total}`);
  console.log(`Title: ${info.game.title}`);
  console.log(`Id: ${info.game.id}`);
  console.log(`Score: ${p.local} ${p.tanteo_local} - ${p.tanteo_visitante} ${p.visitante}`);
  console.log(`State: ${p.estado_partido}`);
  console.log(`Output file: ${info.fileName}`);
  console.log(`Started: ${timestamp(info.started)}`);
  console.log(`Finished: ${timestamp(info.finished)}`);
  console.log(`Duration: ${formatDuration(info.finished - info.started)}`);
  console.log(SEPARATOR);
}

async function waitBeforeNextRequest() {
  const delayMs = randomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
  const nextRequestAt = timestamp(new Date(Date.now() + delayMs));
  console.log(`Waiting ${formatDuration(delayMs)} before the next request (at ${nextRequestAt})...`);
  await sleep(delayMs);
}

/**
 * Downloads the score of every game in GAMES, sequentially.
 * @returns {Promise<{gamesDownloaded: number, totalGames: number}>}
 */
async function downloadScores() {
  const stats = { gamesDownloaded: 0, totalGames: GAMES.length };

  for (let i = 0; i < GAMES.length; i += 1) {
    const game = GAMES[i];
    const started = new Date();

    let data;
    let finished;
    let fileName;
    try {
      data = await fetchScore(game.id);
      finished = new Date();
      fileName = await saveScore(game, data);
    } catch (err) {
      const failed = finished || new Date();
      console.error(SEPARATOR);
      console.error(`Game: ${i + 1}/${GAMES.length}`);
      console.error(`Title: ${game.title}`);
      console.error(`Id: ${game.id}`);
      console.error(`Started: ${timestamp(started)}`);
      console.error(`Failed: ${timestamp(failed)}`);
      console.error(`Duration: ${formatDuration(failed - started)}`);
      console.error(SEPARATOR);
      err.stats = stats;
      throw err;
    }

    logGame({ index: i + 1, total: GAMES.length, game, data, fileName, started, finished });
    stats.gamesDownloaded += 1;

    if (i < GAMES.length - 1) {
      await waitBeforeNextRequest();
    }
  }

  return stats;
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

function validateGames() {
  if (!Array.isArray(GAMES) || GAMES.length === 0) {
    throw new Error('GAMES list is empty. Add at least one { title, id } entry.');
  }

  GAMES.forEach((game, i) => {
    const valid =
      game &&
      typeof game.title === 'string' &&
      game.title.trim() !== '' &&
      typeof game.id === 'string' &&
      game.id.trim() !== '';
    if (!valid) {
      throw new Error(`Invalid GAMES entry at index ${i}: ${JSON.stringify(game)}. Expected { title, id }.`);
    }
  });
}

function printSummary(stats, elapsedMs) {
  console.log('');
  console.log('='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Games downloaded: ${stats.gamesDownloaded}/${stats.totalGames}`);
  console.log(`Total execution time: ${formatDuration(elapsedMs)}`);
  console.log('='.repeat(50));
}

async function main() {
  const startTime = Date.now();

  try {
    validateEnvironment();
    validateGames();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Endpoint: ${buildUrl()}`);
  console.log(`Output directory: ${resolveOutputDir()}`);
  console.log(`Downloading score of ${GAMES.length} game(s).`);

  try {
    const stats = await downloadScores();
    printSummary(stats, Date.now() - startTime);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error('Execution aborted.');
    if (err.stats) {
      printSummary(err.stats, Date.now() - startTime);
    }
    process.exitCode = 1;
  }
}

main();

