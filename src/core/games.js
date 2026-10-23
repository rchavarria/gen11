'use strict';

/**
 * Helpers to read, validate and write <outputDir>/games.json.
 */

const fs = require('node:fs/promises');
const path = require('node:path');

const { writeJson } = require('./files');

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
 * Reads and parses <outputDir>/games.json.
 * @param {{paths: {gamesFile: string}}} config
 * @returns {Promise<{games: object[]}>}
 */
async function readGamesFile(config) {
  const gamesFile = config.paths.gamesFile;
  const raw = await fs.readFile(gamesFile, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${gamesFile}: ${err.message}`);
  }
  if (data === null || typeof data !== 'object' || !Array.isArray(data.games)) {
    throw new Error(`Invalid structure in ${gamesFile}: "games" array is missing.`);
  }
  return data;
}

/**
 * Writes the (updated) games data back to <outputDir>/games.json.
 * @param {{paths: {gamesFile: string}}} config
 * @param {object} data
 */
async function writeGamesFile(config, data) {
  const { gamesFile } = config.paths;
  await writeJson(path.dirname(gamesFile), path.basename(gamesFile), data);
}

module.exports = { isValidGame, readGamesFile, writeGamesFile };

