'use strict';

/**
 * Loads and validates the project configuration from `config.json`, located
 * at the project root. Copy `config.example.json` to `config.json` and fill in
 * your values.
 *
 * Keys:
 *   baseUrl    (required) Base URL of the API (e.g. "https://data.source").
 *   deviceId   (required) Registered device id, sent as `id_dispositivo`.
 *   key        (required) Key sent as `key`.
 *   outputDir  (optional) Root directory for downloaded files. Relative paths
 *              are resolved against the project root. Defaults to ".".
 *
 * The returned object also contains `paths`, with the subfolders/files used by
 * each script (all inside `outputDir`):
 *   paths.games        <outputDir>/games         (download.js)
 *   paths.gamesStats   <outputDir>/games-stats   (download-stats.js)
 *   paths.gamesScores  <outputDir>/games-scores  (download-scores.js)
 *   paths.gamesFile    <outputDir>/games.json    (download-games.js)
 */

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(PROJECT_ROOT, 'config.json');
const EXAMPLE_FILE = 'config.example.json';

function readString(raw, name) {
  const value = raw[name];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new Error(`Invalid "${name}" in ${CONFIG_FILE}: expected a string.`);
  }
  return value.trim();
}

/**
 * Reads and parses config.json, returning the raw JSON object (not validated).
 * @returns {Record<string, unknown>}
 */
function readRawConfig() {
  let text;
  try {
    text = fs.readFileSync(CONFIG_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${CONFIG_FILE}.\nCopy ${EXAMPLE_FILE} to config.json and fill in your values.`);
    }
    throw new Error(`Cannot read ${CONFIG_FILE}: ${err.message}`);
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON in ${CONFIG_FILE}: ${err.message}`);
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid ${CONFIG_FILE}: expected a JSON object.`);
  }

  return raw;
}

/**
 * Reads, validates and returns the configuration.
 * @returns {Readonly<{
 *   baseUrl: string,
 *   deviceId: string,
 *   key: string,
 *   outputDir: string,
 *   paths: Readonly<{games: string, gamesStats: string, gamesScores: string, gamesFile: string}>
 * }>}
 */
function loadConfig() {
  const raw = readRawConfig();

  const baseUrl = readString(raw, 'baseUrl');
  const deviceId = readString(raw, 'deviceId');
  const key = readString(raw, 'key');
  const outputDirRaw = readString(raw, 'outputDir') || '.';

  const missing = [];
  if (baseUrl === '') missing.push('baseUrl');
  if (deviceId === '') missing.push('deviceId');
  if (key === '') missing.push('key');

  if (missing.length > 0) {
    throw new Error(`Missing required configuration value(s) in ${CONFIG_FILE}: ${missing.join(', ')}.`);
  }

  try {
    new URL(baseUrl);
  } catch {
    throw new Error(`Invalid "baseUrl" in ${CONFIG_FILE}: "${baseUrl}"`);
  }

  const outputDir = path.resolve(PROJECT_ROOT, outputDirRaw);

  return Object.freeze({
    baseUrl,
    deviceId,
    key,
    outputDir,
    paths: Object.freeze({
      games: path.join(outputDir, 'games'),
      gamesStats: path.join(outputDir, 'games-stats'),
      gamesScores: path.join(outputDir, 'games-scores'),
      gamesFile: path.join(outputDir, 'games.json'),
    }),
  });
}

/**
 * Persists a new `key` in config.json and returns a new configuration object
 * with the updated key. Every other value in config.json is kept as-is.
 * The file is written atomically (temporary file + rename).
 * @param {ReturnType<typeof loadConfig>} config Current configuration.
 * @param {string} newKey New value for `key`.
 * @returns {ReturnType<typeof loadConfig>}
 */
function updateConfigKey(config, newKey) {
  if (typeof newKey !== 'string' || newKey.trim() === '') {
    throw new Error('updateConfigKey: newKey must be a non-empty string.');
  }
  const key = newKey.trim();

  const raw = readRawConfig();
  raw.key = key;

  const tmpFile = `${CONFIG_FILE}.tmp`;
  try {
    fs.writeFileSync(tmpFile, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    fs.renameSync(tmpFile, CONFIG_FILE);
  } catch (err) {
    try {
      fs.rmSync(tmpFile, { force: true });
    } catch {
      // ignore cleanup errors
    }
    throw new Error(`Cannot write ${CONFIG_FILE}: ${err.message}`);
  }

  return Object.freeze({ ...config, key });
}

module.exports = { loadConfig, updateConfigKey };
