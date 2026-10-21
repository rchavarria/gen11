'use strict';

/**
 * Validation helpers shared by the download scripts.
 */

const fs = require('node:fs/promises');

/**
 * Returns true when a value should be considered "empty" (no error).
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmptyValue(value) {
  if (value === null || value === undefined || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Returns true when the value is a non-null, non-array object.
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Returns true if the given file exists.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = { isEmptyValue, isPlainObject, fileExists };

