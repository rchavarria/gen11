'use strict';

/**
 * Formatting helpers shared by the download scripts.
 */

/**
 * Formats a duration in milliseconds as "HH:MM:SS (<ms> ms)".
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} (${ms} ms)`;
}

/**
 * Returns a timestamp in ISO 8601 format without milliseconds.
 * @param {Date} [date] Defaults to now.
 * @returns {string}
 */
function timestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Returns the local calendar day of a date as "YYYY-MM-DD".
 * @param {Date} [date] Defaults to now.
 * @returns {string}
 */
function toDayString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

module.exports = { formatDuration, timestamp, toDayString };

