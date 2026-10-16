#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Downloads paginated match search results ("partidos") from the data source
 * API and saves every complete JSON response to disk, one file per page.
 * Each response returns a new `key` that must be used in the next request,
 * so pages are downloaded strictly sequentially (never in parallel), with a
 * random pause between 1 and 5 minutes between requests.
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
 * KEY          (required) Initial value for the `key` parameter. It is only
 *              used for the first request; each response returns the key
 *              for the next one.
 * OUTPUT_DIR   (optional) Directory where JSON files are written. Relative
 *              paths are resolved against the current working directory.
 *              Created automatically if it does not exist. Defaults to ".".
 * The script aborts if a required variable is missing or empty.
 *
 * They are loaded from a `.env` file using Node's native `--env-file` flag.
 * Copy `.env.example` to `.env` and fill in the values:
 *
 *   BASE_URL=https://data.source
 *   DEVICE_ID=YOUR_DEVICE_ID
 *   KEY=YOUR_INITIAL_KEY
 *   OUTPUT_DIR=./output
 *
 * CONFIGURATION VARIABLES (in source)
 * -----------------------------------
 * API_PATH            Endpoint path appended to BASE_URL ("/v2/busqueda.ashx").
 * TEXT                Search text, sent as `texto`.
 * ACTION              API action, sent as `accion` (required by the endpoint).
 * PAGE_SIZE           Records per page (always 50).
 * MIN_DELAY_MS        Minimum pause between requests (1 minute).
 * MAX_DELAY_MS        Maximum pause between requests (5 minutes).
 *                     A new random pause within this range is chosen before
 *                     each request (there is no pause after the last page).
 * REQUEST_TIMEOUT_MS  Maximum time allowed for a single HTTP request.
 *
 * COMMAND-LINE ARGUMENTS (in this exact order)
 * --------------------------------------------
 * 1. startPage   First page to download (integer >= 1).
 * 2. totalPages  Total number of pages to download (integer >= 1).
 *
 * REQUEST FORMAT
 * --------------
 * Method:        POST
 * URL:           BASE_URL + API_PATH
 * Content-Type:  application/x-www-form-urlencoded
 * Body:          accion=buscarPartido&texto=<TEXT>&skip=<skip>&id_dispositivo=<DEVICE_ID>&key=<key>
 *
 * skip = (currentPage - 1) * 50
 *
 * NOTE: `id_dispositivo` and `key` may contain "=" characters. The data source
 * does NOT accept them percent-encoded ("%3D"), so these two values are
 * appended raw at the end of the body. All other parameters are encoded
 * normally with URLSearchParams.
 *
 * RESPONSE FORMAT
 * ---------------
 * {
 *   "partidos": [ ... ],
 *   "key": "NEXT_KEY",
 *   "error": null | "" | "<error message>"
 * }
 *
 * FILE NAMING CONVENTION
 * ----------------------
 * <OUTPUT_DIR>/games-<page number padded to 4 digits>.json
 *   games-0001.json, games-0010.json, games-0100.json, games-1234.json
 *
 * ERROR HANDLING RULES
 * --------------------
 * No retries. Execution aborts immediately (exit code 1) on:
 * - Network errors (including request timeouts)
 * - HTTP errors (non-2xx status codes)
 * - Invalid JSON
 * - Invalid response structure (missing `partidos` array or `key`)
 * - Any response whose `error` field contains a non-empty value
 * Invalid command-line arguments or missing environment variables also abort
 * execution.
 *
 * EXECUTION EXAMPLES
 * ------------------
 *   cp .env.example .env    # then edit .env with your values
 *
 *   node --env-file=.env download.js 1 10
 *     Downloads pages 1 to 10 (games-0001.json ... games-0010.json).
 *
 *   node --env-file=.env download.js 101 50
 *     Downloads 50 pages starting from page 101.
 *     To resume a previous run, set KEY in .env to the last received key.
 *     Expected files: games-0101.json, games-0102.json, ..., games-0150.json
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
const USAGE = 'Usage: node --env-file=.env download.js <startPage> <totalPages>';

const API_PATH = '/v2/busqueda.ashx';
const ACTION = 'buscarPartido';
const PAGE_SIZE = 50;

// const TEXT = 'BALONCESTO ALCOBENDAS';
// const TEXT = 'REAL MADRID C.F.';
const TEXT = 'ELITE INTERNATIONAL SCHOOL C.D.E';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Waits for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a random number of milliseconds between minMs and maxMs (inclusive).
 * @param {number} minMs
 * @param {number} maxMs
 * @returns {number}
 */
function randomDelay(minMs, maxMs) {
  return crypto.randomInt(minMs, maxMs + 1);
}

/**
 * Builds the full request URL from BASE_URL and API_PATH.
 * @returns {string}
 */
function buildUrl() {
  const base = BASE_URL.replace(/\/+$/, '');
  const apiPath = API_PATH.startsWith('/') ? API_PATH : `/${API_PATH}`;
  return `${base}${apiPath}`;
}

/**
 * Builds the x-www-form-urlencoded request body.
 * `id_dispositivo` and `key` are appended raw because the data source
 * rejects their percent-encoded "=" characters.
 * @param {number} skip
 * @param {string} key
 * @returns {string}
 */
function buildRequestBody(skip, key) {
  const params = new URLSearchParams({
    accion: ACTION,
    texto: TEXT,
    skip: String(skip),
  });
  return `${params.toString()}&id_dispositivo=${DEVICE_ID}&key=${key}`;
}

/**
 * Calculates the skip value for a 1-based page number.
 * @param {number} pageNumber
 * @returns {number}
 */
function calculateSkip(pageNumber) {
  return (pageNumber - 1) * PAGE_SIZE;
}

/**
 * Returns the output file name for a page number.
 * @param {number} pageNumber
 * @returns {string}
 */
function buildFileName(pageNumber) {
  return `games-${String(pageNumber).padStart(4, '0')}.json`;
}

/**
 * Returns the absolute output directory.
 * @returns {string}
 */
function resolveOutputDir() {
  return path.resolve(process.cwd(), OUTPUT_DIR);
}

/**
 * Returns true when a value should be considered "empty" (no error).
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmptyValue(value) {
  if (value === null || value === undefined || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Formats a duration in milliseconds as a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} (${ms} ms)`;
}

/**
 * Returns a timestamp in ISO 8601 format without milliseconds.
 * @param {Date} [date] Defaults to now.
 * @returns {string}
 */
function timestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// -----------------------------------------------------------------------------
// Core logic
// -----------------------------------------------------------------------------

/**
 * Sends the POST request for one page and returns the parsed, validated JSON.
 * Throws on network errors, HTTP errors, invalid JSON, API errors or an
 * invalid response structure.
 * @param {number} skip
 * @param {string} key
 * @returns {Promise<object>}
 */
async function fetchPage(skip, key) {
  const url = buildUrl();
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildRequestBody(skip, key),
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
 * Validates the structure and error field of an API response.
 * @param {unknown} data
 */
function validateResponse(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid response: expected a JSON object.');
  }

  if ('error' in data && !isEmptyValue(data.error)) {
    throw new Error(`API returned an error: ${JSON.stringify(data.error)}`);
  }

  if (!Array.isArray(data.partidos)) {
    throw new Error('Invalid response: "partidos" field is missing or is not an array.');
  }

  if (typeof data.key !== 'string' || data.key.trim() === '') {
    throw new Error('Invalid response: "key" field is missing or empty.');
  }
}

/**
 * Saves the complete response of a page to disk.
 * @param {number} pageNumber
 * @param {object} responseData
 * @returns {Promise<string>} The generated file name.
 */
async function savePage(pageNumber, responseData) {
  const fileName = buildFileName(pageNumber);
  const outputDir = resolveOutputDir();
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, fileName), `${JSON.stringify(responseData, null, 2)}\n`, 'utf8');
  return fileName;
}

/**
 * Logs the details of a completed request.
 * @param {object} info
 * @param {number} info.page
 * @param {number} info.skip
 * @param {string} info.sentKey
 * @param {string} info.receivedKey
 * @param {number} info.matches
 * @param {string} info.fileName
 * @param {Date} info.started  Request start time.
 * @param {Date} info.finished Request end time (response received and validated).
 */
function logPage(info) {
  console.log(SEPARATOR);
  console.log(`Page: ${info.page}`);
  console.log(`Skip: ${info.skip}`);
  console.log(`Sent key: ${info.sentKey}`);
  console.log(`Received key: ${info.receivedKey}`);
  console.log(`Matches received: ${info.matches}`);
  console.log(`Output file: ${info.fileName}`);
  console.log(`Started: ${timestamp(info.started)}`);
  console.log(`Finished: ${timestamp(info.finished)}`);
  console.log(`Duration: ${formatDuration(info.finished - info.started)}`);
  console.log(SEPARATOR);
}

/**
 * Waits a random time between MIN_DELAY_MS and MAX_DELAY_MS, logging it.
 * @returns {Promise<void>}
 */
async function waitBeforeNextRequest() {
  const delayMs = randomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
  const nextRequestAt = timestamp(new Date(Date.now() + delayMs));
  console.log(`Waiting ${formatDuration(delayMs)} before the next request (at ${nextRequestAt})...`);
  await sleep(delayMs);
}

/**
 * Downloads `totalPages` pages sequentially starting at `startPage`.
 * @param {number} startPage
 * @param {number} totalPages
 * @param {string} initialKey
 * @returns {Promise<{pagesDownloaded: number, totalMatches: number, lastKey: string}>}
 */
async function downloadPages(startPage, totalPages, initialKey) {
  const stats = { pagesDownloaded: 0, totalMatches: 0, lastKey: initialKey };
  let currentKey = initialKey;
  const lastPage = startPage + totalPages - 1;

  for (let page = startPage; page <= lastPage; page += 1) {
    const skip = calculateSkip(page);
    const started = new Date();

    let data;
    let finished;
    let fileName;
    try {
      data = await fetchPage(skip, currentKey);
      finished = new Date();
      fileName = await savePage(page, data);
    } catch (err) {
      const failed = finished || new Date();
      console.error(SEPARATOR);
      console.error(`Page: ${page}`);
      console.error(`Skip: ${skip}`);
      console.error(`Sent key: ${currentKey}`);
      console.error(`Started: ${timestamp(started)}`);
      console.error(`Failed: ${timestamp(failed)}`);
      console.error(`Duration: ${formatDuration(failed - started)}`);
      console.error(SEPARATOR);
      err.stats = stats;
      throw err;
    }

    const receivedKey = data.key;

    logPage({
      page,
      skip,
      sentKey: currentKey,
      receivedKey,
      matches: data.partidos.length,
      fileName,
      started,
      finished,
    });

    stats.pagesDownloaded += 1;
    stats.totalMatches += data.partidos.length;
    stats.lastKey = receivedKey;
    currentKey = receivedKey;

    if (page < lastPage) {
      await waitBeforeNextRequest();
    }
  }

  return stats;
}

/**
 * Validates that the required environment variables are set.
 */
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

/**
 * Parses and validates command-line arguments.
 * @param {string[]} argv
 * @returns {{startPage: number, totalPages: number}}
 */
function parseArguments(argv) {
  if (argv.length < 2) {
    throw new Error(`Missing arguments.\n${USAGE}`);
  }

  const [startPageArg, totalPagesArg] = argv;

  const parsePositiveInt = (value, name) => {
    if (!/^\d+$/.test(value) || Number(value) < 1) {
      throw new Error(`Invalid ${name}: "${value}". It must be an integer >= 1.\n${USAGE}`);
    }
    return Number(value);
  };

  const startPage = parsePositiveInt(startPageArg, 'startPage');
  const totalPages = parsePositiveInt(totalPagesArg, 'totalPages');

  if (startPage + totalPages - 1 > 9999) {
    console.warn('Warning: page numbers above 9999 will produce file names longer than 4 digits.');
  }

  return { startPage, totalPages };
}

/**
 * Prints the final execution summary.
 * @param {{pagesDownloaded: number, totalMatches: number, lastKey: string}} stats
 * @param {number} elapsedMs
 */
function printSummary(stats, elapsedMs) {
  console.log('');
  console.log('='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Pages downloaded: ${stats.pagesDownloaded}`);
  console.log(`Total matches downloaded: ${stats.totalMatches}`);
  console.log(`Last received key: ${stats.lastKey}`);
  console.log(`Total execution time: ${formatDuration(elapsedMs)}`);
  console.log('='.repeat(50));
}

/**
 * Entry point.
 */
async function main() {
  const startTime = Date.now();

  let args;
  try {
    validateEnvironment();
    args = parseArguments(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Endpoint: ${buildUrl()}`);
  console.log(`Output directory: ${resolveOutputDir()}`);
  console.log(`Downloading ${args.totalPages} page(s) starting from page ${args.startPage}.`);

  try {
    const stats = await downloadPages(args.startPage, args.totalPages, KEY);
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
