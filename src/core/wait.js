'use strict';

/**
 * Waiting helpers shared by the download scripts.
 *
 *   shortWait()  random pause between 100 and 200 seconds
 *                (download-stats.js, download-scores.js, download-games.js).
 *   longWait()   random pause between 10 and 15 minutes (download.js).
 */

const crypto = require('node:crypto');

const { formatDuration, timestamp } = require('./format');

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
 * Waits a random time between minMs and maxMs, logging it.
 * @param {number} minMs
 * @param {number} maxMs
 * @returns {Promise<void>}
 */
async function waitBeforeNextRequest(minMs, maxMs) {
  const delayMs = randomDelay(minMs, maxMs);
  const nextRequestAt = timestamp(new Date(Date.now() + delayMs));
  console.log(`Waiting ${formatDuration(delayMs)} before the next request (at ${nextRequestAt})...`);
  await sleep(delayMs);
}

/**
 * Waits a random time between 100 and 200 seconds.
 * @returns {Promise<void>}
 */
function shortWait() {
  const MIN_DELAY_MS = 100 * 1000;
  const MAX_DELAY_MS = 200 * 1000;
  return waitBeforeNextRequest(MIN_DELAY_MS, MAX_DELAY_MS);
}

/**
 * Waits a random time between 10 and 15 minutes.
 * @returns {Promise<void>}
 */
function longWait() {
  const MIN_DELAY_MS = 10 * 60 * 1000;
  const MAX_DELAY_MS = 15 * 60 * 1000;
  return waitBeforeNextRequest(MIN_DELAY_MS, MAX_DELAY_MS);
}

module.exports = { sleep, randomDelay, waitBeforeNextRequest, shortWait, longWait };

