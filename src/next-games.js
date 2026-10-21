#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Downloads the list of upcoming games ("mispartidos") of the followed teams
 * with a single request to the data source API and saves the complete JSON
 * response to disk.
 * The response returns a new `key`, which is written back to config.json as
 * soon as the response is validated (before saving the output file).
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
 * key          (required) Key sent as `key`. Replaced by the received key.
 * outputDir    (optional) Root download directory, resolved against the
 *              project root. Files are written to <outputDir>/next-games,
 *              created automatically if it does not exist.
 * The script aborts if config.json is missing or invalid.
 *
 * CONFIGURATION VARIABLES (in source)
 * -----------------------------------
 * API_PATH            Endpoint path appended to baseUrl ("/v2/mispartidos.ashx").
 * ACTION              API action, sent as `accion` ("listadoProximos").
 * DAYS                Number of days ahead, sent as `dias` (fixed: 21).
 * REQUEST_TIMEOUT_MS  Maximum time allowed for the HTTP request.
 *
 * REQUEST FORMAT
 * --------------
 * Method:        POST
 * URL:           baseUrl + API_PATH
 * Content-Type:  application/x-www-form-urlencoded
 * Body:          accion=listadoProximos&dias=21&id_dispositivo=<deviceId>&key=<key>
 *
 * NOTE: `id_dispositivo` and `key` may contain "=" characters. The data source
 * does NOT accept them percent-encoded ("%3D"), so they are appended raw.
 *
 * RESPONSE FORMAT
 * ---------------
 * {
 *   "resultado": "correcto",
 *   "key": "NEXT_KEY",
 *   "mispartidos": [ ... ],
 *   "error": null | "" | "<error message>"
 * }
 *
 * FILE NAMING CONVENTION
 * ----------------------
 * <outputDir>/next-games/<YYYY-MM-DD>.json  (local date of execution)
 * An existing file for the same date is overwritten.
 *
 * ERROR HANDLING RULES
 * --------------------
 * No retries. Execution aborts (exit code 1) on network errors, HTTP errors,
 * invalid JSON, invalid response structure (missing `mispartidos` array or
 * `key`), a non-empty `error` field or a `resultado` other than "correcto".
 *
 * EXECUTION EXAMPLE
 * -----------------
 *   node src/next-games.js
 * =============================================================================
 */

'use strict';

const { loadConfig, updateConfigKey } = require('./core/config');
const { formatDuration, timestamp, toDayString } = require('./core/format');
const { isEmptyValue } = require('./core/validate');
const { writeJson } = require('./core/files');

// -----------------------------------------------------------------------------
// Global configuration
// -----------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 30 * 1000;
const SEPARATOR = '-'.repeat(50);

const API_PATH = '/v2/mispartidos.ashx';
const ACTION = 'listadoProximos';
const DAYS = 21;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Builds the full request URL from config.baseUrl and API_PATH.
 * @param {{baseUrl: string}} config
 * @returns {string}
 */
function buildUrl(config) {
  const base = config.baseUrl.replace(/\/+$/, '');
  const apiPath = API_PATH.startsWith('/') ? API_PATH : `/${API_PATH}`;
  return `${base}${apiPath}`;
}

/**
 * Builds the x-www-form-urlencoded request body.
 * `id_dispositivo` and `key` are appended raw because the data source
 * rejects their percent-encoded "=" characters.
 * @param {{deviceId: string, key: string}} config
 * @returns {string}
 */
function buildRequestBody(config) {
  const params = new URLSearchParams({ accion: ACTION, dias: String(DAYS) });
  return `${params.toString()}&id_dispositivo=${config.deviceId}&key=${config.key}`;
}

// -----------------------------------------------------------------------------
// Core logic
// -----------------------------------------------------------------------------

/**
 * Sends the POST request and returns the parsed, validated JSON.
 * @param {ReturnType<typeof loadConfig>} config
 * @returns {Promise<object>}
 */
async function fetchNextGames(config) {
  const url = buildUrl(config);
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildRequestBody(config),
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

  if (!Array.isArray(data.mispartidos)) {
    throw new Error('Invalid response: "mispartidos" field is missing or is not an array.');
  }

  if (typeof data.key !== 'string' || data.key.trim() === '') {
    throw new Error('Invalid response: "key" field is missing or empty.');
  }
}

async function main() {
  const started = new Date();

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const sentKey = config.key;
  const fileName = `${toDayString(started)}.json`;

  console.log(`Endpoint: ${buildUrl(config)}`);
  console.log(`Output directory: ${config.paths.nextGames}`);
  console.log(`Days ahead: ${DAYS}`);

  let data;
  try {
    data = await fetchNextGames(config);
    // Persist the rotated key first, so it is never lost.
    config = updateConfigKey(config, data.key);
    await writeJson(config.paths.nextGames, fileName, data);
  } catch (err) {
    const failed = new Date();
    console.error(SEPARATOR);
    console.error(`Sent key: ${sentKey}`);
    if (data && data.key) console.error(`Received key: ${data.key}`);
    console.error(`Started: ${timestamp(started)}`);
    console.error(`Failed: ${timestamp(failed)}`);
    console.error(`Duration: ${formatDuration(failed - started)}`);
    console.error(SEPARATOR);
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const finished = new Date();
  console.log(SEPARATOR);
  console.log(`Sent key: ${sentKey}`);
  console.log(`Received key: ${config.key}`);
  console.log(`Games received: ${data.mispartidos.length}`);
  console.log(`Output file: ${fileName}`);
  console.log(`Started: ${timestamp(started)}`);
  console.log(`Finished: ${timestamp(finished)}`);
  console.log(`Duration: ${formatDuration(finished - started)}`);
  console.log(SEPARATOR);
}

main();

