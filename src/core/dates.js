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

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toIsoDate(value) {
  const match = typeof value === 'string' && /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return '';
  const date = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidIsoDate(date) ? date : '';
}

function isUtcIsoDateTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().replace('.000Z', 'Z') === value;
}

function madridToUtcIso(day, time) {
  if (!isValidIsoDate(day)) return '';
  const match = typeof time === 'string' && /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] || 0) > 59) {
    return `${day}T00:00:00Z`;
  }
  const clock = `${match[1]}:${match[2]}:${match[3] || '00'}`;
  if (clock === '00:00:00') return `${day}T00:00:00Z`;

  const local = `${day}T${clock}`;
  const guess = Date.parse(`${local}Z`);
  // Both offsets are sampled to detect gaps and repeated hours at DST transitions.
  const offsets = new Set(
    [-86400000, 0, 86400000].map((delta) => {
      const instant = guess + delta;
      return Date.parse(`${madridDateTime(new Date(instant))}Z`) - instant;
    }),
  );
  const candidates = [...offsets]
    .map((offset) => guess - offset)
    .filter((value) => madridDateTime(new Date(value)) === local)
    .sort((a, b) => a - b);
  return candidates.length ? new Date(candidates[0]).toISOString().replace('.000Z', 'Z') : '';
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
  toIsoDate,
  isValidIsoDate,
  isUtcIsoDateTime,
  madridToUtcIso,
  madridDay,
  madridToday,
  formatGameDate,
};
