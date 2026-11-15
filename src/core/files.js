'use strict';

/**
 * File helpers shared by the download scripts.
 */

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Writes `data` as pretty-printed JSON to <dir>/<fileName>, creating `dir`
 * if it does not exist.
 * @param {string} dir
 * @param {string} fileName
 * @param {unknown} data
 * @returns {Promise<string>} The file name.
 */
async function writeJson(dir, fileName, data) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return fileName;
}

/**
 * Returns the output file name for a game: <id>.json.
 * @param {string} id
 * @returns {string}
 */
function buildFileName(id) {
  return `${id}.json`;
}

/**
 * Saves the complete stats response of a game to disk.
 * @param {{id: string}} game
 * @param {object} responseData
 * @param {string} outputDir Target directory.
 * @returns {Promise<string>} The generated file name.
 */
function saveStats(game, responseData, outputDir) {
  return writeJson(outputDir, buildFileName(game.id), responseData);
}

/**
 * Saves the complete score response of a game to disk.
 * @param {{id: string}} game
 * @param {object} responseData
 * @param {string} outputDir Target directory.
 * @returns {Promise<string>} The generated file name.
 */
function saveScore(game, responseData, outputDir) {
  return writeJson(outputDir, buildFileName(game.id), responseData);
}

module.exports = { writeJson, buildFileName, saveStats, saveScore };
