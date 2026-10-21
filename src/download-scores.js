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
 * The `key` does not rotate for this endpoint: the same key (read from
 * config.json) is used for every request.
 *
 * REQUIREMENTS
 * ------------
 * - Node.js >= 18 (native global `fetch`).
 * - No external dependencies.
 *
 * CONFIGURATION (config.json)
 * ---------------------------
 * Read and validated by src/config.js (copy config.example.json to config.json):
 * baseUrl      (required) Base URL of the API (e.g. "https://data.source").
 * deviceId     (required) Registered device id, sent as `id_dispositivo`.
 * key          (required) Key sent as `key` in every request.
 * outputDir    (optional) Root download directory, resolved against the
 *              project root. Files are written to <outputDir>/games-scores,
 *              created automatically if it does not exist.
 * The script aborts if config.json is missing or invalid.
 *
 * CONFIGURATION VARIABLES (in source)
 * -----------------------------------
 * API_PATH            Endpoint path appended to baseUrl ("/v2/envivo/partido.ashx").
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
 * URL:           baseUrl + API_PATH
 * Content-Type:  application/x-www-form-urlencoded
 * Body:          id_partido=<id>&id_dispositivo=<deviceId>&key=<key>
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
 * <outputDir>/games-scores/<title>-<id>.json
 *
 * ERROR HANDLING RULES
 * --------------------
 * No retries. Execution aborts immediately (exit code 1) on network errors,
 * HTTP errors, invalid JSON, invalid response structure, a non-empty `error`
 * field or a `resultado` other than "correcto". An invalid config.json
 * or an invalid GAMES list also abort execution.
 *
 * EXECUTION EXAMPLE
 * -----------------
 *   node src/download-scores.js
 * =============================================================================
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { loadConfig } = require('./config');

// -----------------------------------------------------------------------------
// Global configuration
// -----------------------------------------------------------------------------

const MIN_DELAY_MS = 100 * 1000;
const MAX_DELAY_MS = 200 * 1000;
const REQUEST_TIMEOUT_MS = 30 * 1000;
const SEPARATOR = '-'.repeat(50);

const API_PATH = '/v2/envivo/partido.ashx';

/** @type {{title: string, id: string}[]} */
const GAMES = [
  // { title: 'cadete-g1-f1', id: '300070006700750046004E006E00...' },
  // {
  //   title: 'cadete-g2-f1-j02-torrelodones-alcobendas',
  //   id: '6200450062007A004A00670078007700630074007A007900470049006100330050005A0056005A00740077003D003D00'
  // },
  // {
  //   title: 'cadete-g2-f1-j02-laso-zentro',
  //   id: '6E006E0049005A00520048006F00560033005600360033006D004A00530067005200580057003300380067003D003D00'
  // },
  // {
  //   title: 'cadete-g2-f1-j02-estudiantes-alcorcon',
  //   id: '6900680032002B00730032006700720053007000680063004B0045003200350064003800540061004F0041003D003D00'
  // },
  // {
  //   title: 'cadete-g2-f1-j03-alcobendas-alcorcon',
  //   id: '6C0055006300460049006B004D006E0049006C0070006400770066007A004B003700770072005000300077003D003D00'
  // },
  // {
  //   title: 'cadete-g2-f1-j03-zentro-estudiantes',
  //   id: '56004700700065007500300068004600640077007100750044007900420071007800620078007700340051003D003D00'
  // },
  // {
  //   title: 'cadete-g2-f1-j03-torrelodones-laso',
  //   id: '2B0043003600640044004D006F006100710051005000490038004F00710032007900350034006500790077003D003D00'
  // },
  // {
  //   title: 'cadete-g2-f1-j06-estudiantes-alcobendas',
  //   id: '6F00530055006B00390061006F004600530072003800630066002B004A006400700051006F007500520041003D003D00'
  // },
  // {
  //   title: 'cadete-g2-f1-j06-laso-alcorcon',
  //   id: '7800580075004E0059005800670034007800700065005A0051006200620064004F006F0054005000460067003D003D00'
  // },
  // {
  //   title: 'cadete-g1-f1-j01-canoe-sanjorge',
  //   id: '74004D00530062006D007400440031005900410072006A00380045004F0034005600680074003700350067003D003D00'
  // },
  // {
  //   title: 'cadete-g1-f1-j01-distrito-fuenlabrada',
  //   id: '5A007A004E00410059003800560077006800700069004200780034004F0048005A006B0066006200630041003D003D00'
  // },
  // {
  //   title: 'cadete-g1-f1-j01-madrid-sba',
  //   id: '41006B0058002B004C00500062006C00530053004D0058003300730075006200760030007A006400490067003D003D00'
  // },
  // {
  //   title: 'cadete-g1-f1-j02-sba-canoe',
  //   id: '4F003900760055007800790069006D0049005500500073006900560048004F0035006F00350031006A0067003D003D00'
  // },
  // {
  //   title: 'cadete-g1-f1-j02-sanjorge-distrito',
  //   id: '330034006E0070004D0052004A005800730069006400500059007100640044004A006E0051006300740077003D003D00'
  // },
  // {
  //   title: 'cadete-g1-f1-j03-canoe-distrito',
  //   id: '74004D006C00460058007A0044004500650037006D006F0061004700570056005600640036004B00660041003D003D00'
  // },
  // {
  //   title: 'cadete-g1-f1-j03-madrid-sanjorge',
  //   id: '66006F005900700042005600330058004D006F0070003300430072005200300077004C0056005300700041003D003D00'
  // },
  // {
  //   title: 'cadete-g1-f1-j03-sba-fuenlabrada',
  //   id: '520044004F00540044006F007A00470032005A004E00450066005600580042002B006100520042004F0041003D003D00'
  // },
  {
    title: 'cadete-g2-f1-j04-alcobendas-laso',
    id: '48006900570049006D006C0039004300770073006F00710049005A00730062003000410048006D00410051003D003D00'
  },
  {
    title: 'cadete-g2-f1-j04-estudiantes-torrelodones',
    id: '79006A006800500068006A00590059006D004F004C00680054006E0068006B003500370058005400550041003D003D00'
  },
  {
    title: 'cadete-g2-f1-j04-alcorcon-zentro',
    id: '54003800780050003500730059006C006B006B004A00760071003800430032003400410055003200380077003D003D00'
  },
  {
    title: 'cadete-g1-f1-j04-canoe-fuenlabrada',
    id: '750052004E0068005000530050002F00790049004A006D00580034006A00370050005A0044005700360077003D003D00'
  },
  {
    title: 'cadete-g1-f1-j04-sanjorge-sba',
    id: '37004F0054007A00780068006100340039007700690077006400540042005A00300067007A0076006C0041003D003D00'
  },
  {
    title: 'cadete-g1-f1-j04-distrito-madrid',
    id: '3300760067006C00620077006E0079004F004B006100780050005600500047004300420039006800790077003D003D00'
  },
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
 * @param {string} gameId
 * @returns {string}
 */
function buildRequestBody(config, gameId) {
  const params = new URLSearchParams({ id_partido: gameId });
  return `${params.toString()}&id_dispositivo=${config.deviceId}&key=${config.key}`;
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
 * @param {{baseUrl: string, deviceId: string, key: string}} config
 * @param {string} gameId
 * @returns {Promise<object>}
 */
async function fetchScore(config, gameId) {
  const url = buildUrl(config);
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildRequestBody(config, gameId),
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
    const error = new Error(`API returned an error: ${JSON.stringify(data.error)}`);
    error.apiError = data.error;
    throw error;
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
 * @param {string} outputDir Target directory.
 * @returns {Promise<string>} The generated file name.
 */
async function saveScore(game, responseData, outputDir) {
  const fileName = buildFileName(game.title, game.id);
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
 * @param {ReturnType<typeof loadConfig>} config
 * @returns {Promise<{gamesDownloaded: number, totalGames: number}>}
 */
async function downloadScores(config) {
  const stats = { gamesDownloaded: 0, totalGames: GAMES.length };

  for (let i = 0; i < GAMES.length; i += 1) {
    const game = GAMES[i];
    const started = new Date();

    let data;
    let finished;
    let fileName;
    try {
      data = await fetchScore(config, game.id);
      finished = new Date();
      fileName = await saveScore(game, data, config.paths.gamesScores);
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

  let config;
  try {
    config = loadConfig();
    validateGames();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Endpoint: ${buildUrl(config)}`);
  console.log(`Output directory: ${config.paths.gamesScores}`);
  console.log(`Downloading score of ${GAMES.length} game(s).`);

  try {
    const stats = await downloadScores(config);
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

module.exports = { fetchScore, saveScore, buildFileName };

// Only run when executed directly, not when required as a module.
if (require.main === module) {
  main();
}

