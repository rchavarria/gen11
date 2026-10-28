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
 * random pause between 10 and 15 minutes between requests.
 *
 * The request, response validation and key rotation are delegated to
 * ApiClient.searchGames() (src/core/api-client.js).
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
 * key          (required) Initial value for the `key` parameter. It is only
 *              used for the first request; each response returns the key
 *              for the next one. The received key is written back to
 *              config.json as soon as each response is validated, before
 *              the page file is saved.
 * outputDir    (optional) Root download directory, resolved against the
 *              project root. Files are written to <outputDir>/games,
 *              created automatically if it does not exist.
 * The script aborts if config.json is missing or invalid.
 *
 * Example config.json (see config.example.json):
 *
 *   {
 *     "baseUrl": "https://data.source",
 *     "deviceId": "YOUR_DEVICE_ID",
 *     "key": "YOUR_INITIAL_KEY",
 *     "outputDir": "./downloads"
 *   }
 *
 * CONFIGURATION VARIABLES (in source)
 * -----------------------------------
 * TEXT                Search text, sent as `texto`.
 * PAGE_SIZE           Records per page (always 50).
 *
 * The pause between requests is defined by longWait() in src/core/wait.js
 * (random, between 10 and 15 minutes). A new random pause is chosen before
 * each request (there is no pause after the last page).
 *
 * COMMAND-LINE ARGUMENTS (in this exact order)
 * --------------------------------------------
 * 1. startPage   First page to download (integer >= 1).
 * 2. totalPages  Total number of pages to download (integer >= 1).
 *
 * PAGINATION
 * ----------
 * skip = (currentPage - 1) * 50
 *
 * FILE NAMING CONVENTION
 * ----------------------
 * <outputDir>/games/games-<page number padded to 4 digits>.json
 *   games-0001.json, games-0010.json, games-0100.json, games-1234.json
 *
 * ERROR HANDLING RULES
 * --------------------
 * No retries. Execution aborts immediately (exit code 1) on:
 * - Network errors (including request timeouts)
 * - HTTP errors (non-2xx status codes)
 * - Invalid JSON
 * - Invalid response structure (missing `partidos` array, or `key` missing
 *   or equal to the sent one)
 * - Any response whose `error` field contains a non-empty value
 * Invalid command-line arguments or an invalid config.json also abort
 * execution.
 *
 * EXECUTION EXAMPLES
 * ------------------
 *   cp config.example.json config.json    # then edit config.json with your values
 *
 *   node src/previous-games.js 1 10
 *     Downloads pages 1 to 10 (games-0001.json ... games-0010.json).
 *
 *   node src/previous-games.js 101 50
 *     Downloads 50 pages starting from page 101.
 *     After every downloaded page, the received key is saved as "key" in
 *     config.json, so a later run resumes with the last valid key.
 * =============================================================================
 */

'use strict';

const { ApiClient } = require('./core/api-client');
const { loadConfig } = require('./core/config');
const { longWait } = require('./core/wait');
const { formatDuration, timestamp } = require('./core/format');
const { writeJson } = require('./core/files');

// -----------------------------------------------------------------------------
// Global configuration
// -----------------------------------------------------------------------------

const SEPARATOR = '-'.repeat(50);
const USAGE = 'Usage: node src/previous-games.js <startPage> <totalPages>';

const PAGE_SIZE = 50;

const TEXT = 'BALONCESTO ALCOBENDAS';
// const TEXT = 'REAL MADRID C.F.';
// const TEXT = 'ELITE INTERNATIONAL SCHOOL C.D.E'; // S.B.A.
// const TEXT = 'TORRELODONES A.D.';
// const TEXT = 'GIGANTES YOUTH SPORTS ACADEMY C.D.B.'; // Laso
// const TEXT = 'ESTUDIANTES';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Core logic
// -----------------------------------------------------------------------------

/**
 * Saves the complete response of a page to disk.
 * @param {{paths: {games: string}}} config
 * @param {number} pageNumber
 * @param {object} responseData
 * @returns {Promise<string>} The generated file name.
 */
async function savePage(config, pageNumber, responseData) {
  return writeJson(config.paths.games, buildFileName(pageNumber), responseData);
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
 * Downloads `totalPages` pages sequentially starting at `startPage`, using
 * the client's current key as the initial key. ApiClient persists every
 * received key in config.json before returning the data, so the key is never
 * lost if writing the page file fails.
 * @param {ApiClient} client
 * @param {number} startPage
 * @param {number} totalPages
 * @returns {Promise<{pagesDownloaded: number, totalMatches: number, lastKey: string}>}
 */
async function downloadPages(client, startPage, totalPages) {
  const stats = { pagesDownloaded: 0, totalMatches: 0, lastKey: client.key };
  const lastPage = startPage + totalPages - 1;

  for (let page = startPage; page <= lastPage; page += 1) {
    const skip = calculateSkip(page);
    const started = new Date();
    const sentKey = client.key;

    let data;
    let finished;
    let fileName;
    try {
      data = await client.searchGames({ text: TEXT, skip });
      finished = new Date();
      fileName = await savePage(client.config, page, data);
    } catch (err) {
      const failed = finished || new Date();
      console.error(SEPARATOR);
      console.error(`Page: ${page}`);
      console.error(`Skip: ${skip}`);
      console.error(`Sent key: ${sentKey}`);
      if (client.key !== sentKey) console.error(`Received key: ${client.key}`);
      console.error(`Started: ${timestamp(started)}`);
      console.error(`Failed: ${timestamp(failed)}`);
      console.error(`Duration: ${formatDuration(failed - started)}`);
      console.error(SEPARATOR);
      err.stats = stats;
      throw err;
    }

    const receivedKey = client.key;

    logPage({
      page,
      skip,
      sentKey,
      receivedKey,
      matches: data.partidos.length,
      fileName,
      started,
      finished,
    });

    stats.pagesDownloaded += 1;
    stats.totalMatches += data.partidos.length;
    stats.lastKey = receivedKey;

    if (page < lastPage) {
      await longWait();
    }
  }

  return stats;
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

  let client;
  let args;
  try {
    client = new ApiClient(loadConfig());
    args = parseArguments(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Output directory: ${client.config.paths.games}`);
  console.log(`Downloading ${args.totalPages} page(s) starting from page ${args.startPage}.`);

  try {
    const stats = await downloadPages(client, args.startPage, args.totalPages);
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
