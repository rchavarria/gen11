// Calendar days use Madrid time; midnight UTC marks an unknown game time.

const madridFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function madridParts(date) {
  return Object.fromEntries(madridFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

export function madridToday(now = new Date()) {
  const { year, month, day } = madridParts(now);
  return `${year}-${month}-${day}`;
}

function hasUnknownTime(date) {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

export function gameDay(date) {
  if (hasUnknownTime(date)) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  return madridToday(date);
}

export function gameTime(date) {
  if (hasUnknownTime(date)) return null;
  const { hour, minute } = madridParts(date);
  return `${hour}:${minute}`;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function pad(n) {
  return String(n).padStart(2, '0');
}

export function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function mondayOf(date) {
  const offset = (date.getDay() + 6) % 7;
  return addDays(date, -offset);
}

/** "YYYY-MM" of a date. */
export function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Parses "YYYY-MM", returning null when invalid. */
export function parseMonthKey(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key || '');
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month: month - 1 };
}

export function shiftMonth({ year, month }, delta) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function formatMonth({ year, month }) {
  const name = MONTHS[month];
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}

/**
 * Monday-to-Sunday weeks overlapping the given month. A week crossing two
 * months belongs to both.
 * @returns {{start: string, end: string}[]}
 */
export function weeksOfMonth({ year, month }) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const weeks = [];
  for (let start = mondayOf(first); start <= last; start = addDays(start, 7)) {
    weeks.push({ start: toIsoDate(start), end: toIsoDate(addDays(start, 6)) });
  }
  return weeks;
}

/** "lun 27 oct – dom 2 nov" */
export function formatWeek({ start, end }) {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  const short = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return `${short(a)} – ${short(b)}`;
}

/** "sáb 18 oct" */
export function formatDay(iso) {
  const d = parseIsoDate(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
