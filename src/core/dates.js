'use strict';

const madridFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function madridParts(date) {
  return Object.fromEntries(madridFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

function localDateTime(date) {
  const { year, month, day, hour, minute, second } = madridParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function isUtcIsoDateTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().replace('.000Z', 'Z') === value;
}

/**
 * Converts downloaded Fecha (dd/mm/yyyy) and Hora (HH:mm:ss) from Madrid to UTC.
 * Accounts for daylight saving time; midnight UTC marks an unknown game time.
 * Returns null for invalid dates or nonexistent Madrid times.
 */
function downloadedToUtcIso(fecha, hora) {
  const [day, month, year] = (fecha || '').split('/');
  const local = `${year}-${month}-${day}T${hora || '00:00:00'}`;
  const date = new Date(`${local}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 19) !== local) return null;
  if (!hora || hora === '00:00:00') return date.toISOString().replace('.000Z', 'Z');

  // Try the previous day's offset first to select the earlier repeated autumn hour.
  for (const instant of [date.getTime() - 86400000, date.getTime()]) {
    const offset = Date.parse(`${localDateTime(new Date(instant))}Z`) - instant;
    const utc = new Date(date.getTime() - offset);
    if (localDateTime(utc) === local) return utc.toISOString().replace('.000Z', 'Z');
  }
  return null;
}

/**
 * Returns the Europe/Madrid day of a UTC ISO string, preserving unknown-time midnight markers.
 * '2026-11-08T23:30:00Z' -> '2026-11-09'
 * '2026-11-09T00:00:00Z' -> '2026-11-09' (unknown time)
 * '2026-11-09T14:00:00Z' -> '2026-11-09' (typical case)
 * null, '' or '2026-02-31T12:00:00Z' -> '' (invalid date)
 */
function localDay(value) {
  if (!isUtcIsoDateTime(value)) return '';
  if (value.endsWith('T00:00:00Z')) return value.slice(0, 10);
  return localDateTime(new Date(value)).slice(0, 10);
}

module.exports = {
  isUtcIsoDateTime,
  downloadedToUtcIso,
  localDay,
};
