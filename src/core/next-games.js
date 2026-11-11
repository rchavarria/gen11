'use strict';

/**
 * Upcoming games logic shared by next-games.js and sync.js.
 */

const { writeJson } = require('./files');
const { toDayString } = require('./format');
const { readDatedGamesFile, writeDatedGamesFile } = require('./dated-games');
const { ApiError } = require('./api-client');
const { shorterWait } = require('./wait');
const { loadVenues } = require('./venues');

const DAYS = 100;

/**
 * Converts "dd/mm/yyyy" to "YYYY-MM-DD". Returns "" when it is not valid.
 * @param {unknown} ddmmyyyy
 * @returns {string}
 */
function toIsoDate(ddmmyyyy) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy || '');
  if (!match) return '';
  const [, day, month, year] = match;
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  if (
    value.getUTCFullYear() !== Number(year) ||
    value.getUTCMonth() !== Number(month) - 1 ||
    value.getUTCDate() !== Number(day)
  )
    return '';
  return `${year}-${month}-${day}`;
}

function isValidIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return Boolean(match && toIsoDate(`${match[3]}/${match[2]}/${match[1]}`) === value);
}

/**
 * Adds new upcoming games and refreshes the date, time and venue of known games.
 * Mutates and sorts `games`.
 * @param {object[]} games
 * @param {object[]} upcomingGames The `mispartidos` array of the response.
 * @param {Map<string, string>} venues Exact venue name -> slug.
 * @returns {{added: object[], updated: object[], unmatchedVenues: string[]}}
 */
function mergeDatedGames(games, upcomingGames, venues = new Map()) {
  const byId = new Map();
  for (const game of games) {
    if (game && typeof game.id === 'string' && game.id !== '' && !byId.has(game.id)) {
      byId.set(game.id, game);
    }
  }

  const added = [];
  const updated = [];
  const unmatchedVenues = new Set();
  for (const upcoming of upcomingGames) {
    const id = upcoming?.IdPartido;
    if (typeof id !== 'string' || id === '') continue;
    const date = toIsoDate(upcoming.Fecha);
    const venueName = upcoming.CampoJuego;
    const venue = venues.get(venueName) || '';
    if (!venue) unmatchedVenues.add(venueName || '(missing CampoJuego)');
    const existing = byId.get(id);
    if (existing) {
      let changed = false;
      if (date && existing.date !== date) {
        existing.date = date;
        changed = true;
      }
      const time = upcoming.Hora ?? '';
      if (existing.time !== time) {
        existing.time = time;
        changed = true;
      }
      if (existing.venue !== venue) {
        existing.venue = venue;
        changed = true;
      }
      if (changed && !updated.includes(existing)) updated.push(existing);
      continue;
    }

    const game = {
      slug: '',
      id,
      date,
      time: upcoming.Hora ?? '',
      venue,
      category: upcoming.Categoria ?? '',
      homeClubName: upcoming.NombreClubLocal ?? '',
      awayClubName: upcoming.NombreClubVisitante ?? '',
      downloaded: false,
      scored: false,
    };
    games.push(game);
    byId.set(id, game);
    added.push(game);
  }

  games.sort((a, b) => {
    const aDate = isValidIsoDate(a.date);
    const bDate = isValidIsoDate(b.date);
    if (aDate !== bDate) return aDate ? -1 : 1;
    return `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`);
  });
  return { added, updated, unmatchedVenues: [...unmatchedVenues] };
}

/**
 * Requests the upcoming games and saves the raw response to
 * <outputDir>/next-games/<YYYY-MM-DD>.json, then merges the received games
 * into <outputDir>/dated-games.json.
 * @param {import('./api-client').ApiClient} client
 * @param {{days?: number, date?: Date}} [options]
 * @returns {Promise<{data: object, fileName: string, added: object[], updated: object[], unmatchedVenues: string[], total: number}>}
 */
async function fetchNextGames(client, { days = DAYS, date = new Date() } = {}) {
  const fileName = `${toDayString(date)}.json`;
  // ApiClient persists the rotated key before returning the data.
  const data = await client.getNextGames({ days });
  await writeJson(client.config.paths.nextGames, fileName, data);

  const datedGames = await readDatedGamesFile(client.config);
  const venues = await loadVenues();
  const { added, updated, unmatchedVenues } = mergeDatedGames(datedGames['dated-games'], data.mispartidos, venues);
  await writeDatedGamesFile(client.config, datedGames);
  return { data, fileName, added, updated, unmatchedVenues, total: datedGames['dated-games'].length };
}

/**
 * Fetches upcoming games, renewing the key and retrying once on an API error.
 * @param {import('./api-client').ApiClient} client
 * @param {{days?: number, date?: Date}} [options]
 * @param {{wait?: () => Promise<void>, onKeyRenewed?: () => void}} [hooks]
 * @returns {Promise<{data: object, fileName: string, added: object[], updated: object[], unmatchedVenues: string[], total: number, keyRenewed: boolean}>}
 */
async function fetchNextGamesRenewingKey(client, options = {}, { wait = shorterWait, onKeyRenewed = () => {} } = {}) {
  try {
    return { ...(await fetchNextGames(client, options)), keyRenewed: false };
  } catch (err) {
    if (!(err instanceof ApiError) && err?.name !== 'ApiError') throw err;
  }

  await wait();
  await client.renewKey();
  onKeyRenewed();
  console.log('Key renewed.');
  await wait();
  return { ...(await fetchNextGames(client, options)), keyRenewed: true };
}

module.exports = { DAYS, toIsoDate, mergeDatedGames, fetchNextGames, fetchNextGamesRenewingKey };
