#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Registers again a fixed, already registered uid (REGISTER_UID in
 * src/core/api-client.js) to obtain a new `key` from the data source API,
 * and saves it in config.json. The API answers with the error
 * "uuid ya registrado", which is expected and accepted.
 *
 * The request, response validation and key persistence are delegated to
 * ApiClient.renewKey() (src/core/api-client.js).
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
 * deviceId     (required) Registered device id. Never changed.
 * key          (required) Current key. Replaced by the received key.
 * The script aborts if config.json is missing or invalid.
 *
 * ERROR HANDLING RULES
 * --------------------
 * No retries. Execution aborts (exit code 1) and the key is NOT saved on
 * network errors, HTTP errors, invalid JSON, a non-empty `error` field other
 * than "uuid ya registrado", a `resultado` other than "correcto" (when there
 * is no error), a missing/empty `key`, or a non-empty `id_dispositivo`
 * different from config.deviceId.
 *
 * EXECUTION EXAMPLE
 * -----------------
 *   node src/renew-key.js
 * =============================================================================
 */

'use strict';

const { ApiClient } = require('./core/api-client');
const { loadConfig } = require('./core/config');
const { formatDuration, timestamp } = require('./core/format');

// -----------------------------------------------------------------------------
// Global configuration
// -----------------------------------------------------------------------------

const SEPARATOR = '-'.repeat(50);

// -----------------------------------------------------------------------------
// Core logic
// -----------------------------------------------------------------------------

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

  const previousKey = client.key;

  let data;
  try {
    // ApiClient persists the new key in config.json before returning.
    data = await client.renewKey();
  } catch (err) {
    const failed = new Date();
    console.error(SEPARATOR);
    console.error(`Previous key: ${previousKey}`);
    console.error(`Device id: ${client.config.deviceId}`);
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
  console.log(`Previous key: ${previousKey}`);
  console.log(`New key: ${client.key}`);
  if (client.key === previousKey) console.log('(The received key is the same as the previous one.)');
  console.log(`Device id: ${data.id_dispositivo || client.config.deviceId}`);
  if (data.error) console.log(`API error (expected): ${data.error}`);
  console.log(`Started: ${timestamp(started)}`);
  console.log(`Finished: ${timestamp(finished)}`);
  console.log(`Duration: ${formatDuration(finished - started)}`);
  console.log(SEPARATOR);
}

main();

