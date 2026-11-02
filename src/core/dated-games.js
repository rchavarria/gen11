'use strict';

/**
 * Helpers to read and write <outputDir>/dated-games.json.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { writeJson } = require('./files');

/**
 * Reads <outputDir>/dated-games.json, returning an empty list when it does not exist.
 * @param {{paths: {datedGamesFile: string}}} config
 * @returns {Promise<{ 'dated-games': object[] }>}
 */
async function readDatedGamesFile(config) {
  const file = config.paths.datedGamesFile;
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { 'dated-games': [] };
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${file}: ${err.message}`);
  }
  if (data === null || typeof data !== 'object' || !Array.isArray(data['dated-games'])) {
    throw new Error(`Invalid structure in ${file}: "dated-games" array is missing.`);
  }
  return data;
}

/**
 * Writes dated games to <outputDir>/dated-games.json.
 * @param {{paths: {datedGamesFile: string}}} config
 * @param {{'dated-games': object[]}} data
 */
async function writeDatedGamesFile(config, data) {
  const file = config.paths.datedGamesFile;
  await writeJson(path.dirname(file), path.basename(file), data);
}

module.exports = { readDatedGamesFile, writeDatedGamesFile };
