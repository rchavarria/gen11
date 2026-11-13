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

function madridDateTime(date) {
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
    const offset = Date.parse(`${madridDateTime(new Date(instant))}Z`) - instant;
    const utc = new Date(date.getTime() - offset);
    if (madridDateTime(utc) === local) return utc.toISOString().replace('.000Z', 'Z');
  }
  return null;
}

function madridDay(value) {
  if (!isUtcIsoDateTime(value)) return '';
  if (value.endsWith('T00:00:00Z')) return value.slice(0, 10);
  return madridDateTime(new Date(value)).slice(0, 10);
}

function madridToday(now = new Date()) {
  return madridDateTime(now).slice(0, 10);
}

function formatGameDate(value) {
  const day = madridDay(value);
  if (!day) return '(no date)';
  return value.endsWith('T00:00:00Z') ? day : madridDateTime(new Date(value)).replace('T', ' ').slice(0, 16);
}

module.exports = {
  isUtcIsoDateTime,
  downloadedToUtcIso,
  madridDay,
  madridToday,
  formatGameDate,
};
