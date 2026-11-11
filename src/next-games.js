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
 * response to disk. Finally, it prints a summary of every received game
 * (NombreEquipoLocal, NombreEquipoVisitante, Fecha and IdPartido).
 *
 * The request, response validation and key rotation are delegated to
 * ApiClient.getNextGames() (src/core/api-client.js). When the response
 * returns a new `key`, ApiClient writes it back to config.json before the
 * output file is saved.
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
 *              project root. The daily response is written to
 *              <outputDir>/next-games; accumulated games go to
 *              <outputDir>/dated-games.json.
 *              created automatically if it does not exist.
 * The script aborts if config.json is missing or invalid.
 *
 * CONFIGURATION VARIABLES (in source)
 * -----------------------------------
 * DAYS                Number of days ahead, sent as `dias` (fixed: 21,
 *                     defined in src/core/next-games.js).
 *
 * FILE NAMING CONVENTION
 * ----------------------
 * <outputDir>/next-games/<YYYY-MM-DD>.json  (local date of execution)
 * An existing file for the same date is overwritten.
 * <outputDir>/dated-games.json accumulates games by IdPartido. New games are
 * added; existing games have date, time and venue refreshed. The venue slug
 * is resolved from CampoJuego using src/data/venues.json. Unknown venues are
 * left empty and reported as warnings. Entries are sorted by date and time.
 *
 * ERROR HANDLING RULES
 * --------------------
 * No retries. Execution aborts (exit code 1) on network errors, HTTP errors,
 * invalid JSON, invalid response structure (missing `mispartidos` array),
 * a non-empty `error` field or a `resultado` other than "correcto".
 *
 * EXECUTION EXAMPLE
 * -----------------
 *   node src/next-games.js
 * =============================================================================
 */

'use strict';

const { ApiClient } = require('./core/api-client');
const { loadConfig } = require('./core/config');
const { formatDuration, timestamp, toDayString } = require('./core/format');
const { DAYS, fetchNextGames } = require('./core/next-games');

// -----------------------------------------------------------------------------
// Global configuration
// -----------------------------------------------------------------------------

const SEPARATOR = '-'.repeat(50);

// -----------------------------------------------------------------------------
// Core logic
// -----------------------------------------------------------------------------

/**
 * Prints a summary of every received game: NombreEquipoLocal,
 * NombreEquipoVisitante, Fecha and IdPartido.
 * @param {object[]} games The `mispartidos` array of the response.
 */
function printGamesSummary(games) {
  console.log('');
  console.log('='.repeat(50));
  console.log(`Games summary (${games.length})`);
  console.log('='.repeat(50));
  games.forEach((game, i) => {
    const g = game || {};
    console.log(`Game: ${i + 1}/${games.length}`);
    console.log(`  ${g.NombreEquipoLocal ?? ''} 🆚 ${g.NombreEquipoVisitante ?? ''}`);
    console.log(`  📆 ${g.Fecha ?? ''} ➡️ ${g.IdPartido}`);
  });
  console.log('='.repeat(50));
}

async function main() {
  const started = new Date();

  let client;
  try {
    client = new ApiClient(loadConfig());
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const sentKey = client.key;
  const fileName = `${toDayString(started)}.json`;

  console.log(`Daily output directory: ${client.config.paths.nextGames}`);
  console.log(`Accumulated games file: ${client.config.paths.datedGamesFile}`);
  console.log(`Days ahead: ${DAYS}`);

  let data;
  let summary;
  try {
    // ApiClient persists the rotated key before returning the data.
    summary = await fetchNextGames(client, { days: DAYS, date: started });
    ({ data } = summary);
  } catch (err) {
    const failed = new Date();
    console.error(SEPARATOR);
    console.error(`Sent key: ${sentKey}`);
    if (client.key !== sentKey) console.error(`Received key: ${client.key}`);
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
  console.log(`Received key: ${client.key}`);
  console.log(`Games received: ${data.mispartidos.length}`);
  console.log(`Dated games added: ${summary.added.length}`);
  console.log(`Dated games updated: ${summary.updated.length}`);
  console.log(`Total dated games: ${summary.total}`);
  for (const name of summary.unmatchedVenues) {
    console.warn(`Venue not found in src/data/venues.json: "${name}"`);
  }
  console.log(`Output file: ${fileName}`);
  console.log(`Started: ${timestamp(started)}`);
  console.log(`Finished: ${timestamp(finished)}`);
  console.log(`Duration: ${formatDuration(finished - started)}`);
  console.log(SEPARATOR);

  printGamesSummary(data.mispartidos);
}

main();
