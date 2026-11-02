'use strict';

/**
 * Upcoming games logic shared by next-games.js and sync.js.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { writeJson } = require('./files');
const { toDayString } = require('./format');

const DAYS = 21;
const NEXT_GAMES_FILE = 'next-games.json';

function toGameDate(game) {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(game.Fecha || '');
  const time = /^(\d{2}):(\d{2}):(\d{2})$/.exec(game.Hora || '00:00:00');
  if (!date || !time) return null;

  const [, day, month, year] = date.map(Number);
  const [, hour, minute, second] = time.map(Number);
  const value = new Date(year, month - 1, day, hour, minute, second);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 ||
      value.getDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
  return value;
}

function mergeNextGamesList(existing, received) {
  const games = new Map();
  for (const game of [...existing, ...received]) {
    if (game && game.IdPartido) games.set(game.IdPartido, game);
  }
  return [...games.values()]
    .map((game) => ({ game, date: toGameDate(game) }))
    .sort((a, b) => {
      if (a.date && b.date) {
        const difference = a.date - b.date;
        if (difference) return difference;
      } else if (a.date || b.date) {
        return a.date ? -1 : 1;
      }
      return String(a.game.IdPartido).localeCompare(String(b.game.IdPartido));
    })
    .map(({ game }) => game);
}

/**
 * Converts "dd/mm/yyyy" to "YYYY-MM-DD". Returns "" when it is not valid.
 * @param {unknown} ddmmyyyy
 * @returns {string}
 */
function toIsoDate(ddmmyyyy) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy || '');
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

/**
 * Adds to `data.games` (mutating it) every upcoming game whose `IdPartido` is
 * not already there. New entries have an empty slug, to be filled by hand.
 * @param {{games: object[]}} data
 * @param {object[]} upcomingGames The `mispartidos` array of the response.
 * @returns {{id: string, date: string, home: string, away: string}[]} Added games.
 */
function mergeNewGames(data, upcomingGames) {
  const knownIds = new Set(data.games.map((game) => game && game.id).filter(Boolean));
  const added = [];
  for (const upcoming of upcomingGames) {
    const id = upcoming && upcoming.IdPartido;
    if (!id || knownIds.has(id)) continue;
    knownIds.add(id);
    const date = toIsoDate(upcoming.Fecha);
    data.games.push({ slug: '', id, date, downloaded: false, played: false });
    added.push({
      id,
      date,
      home: upcoming.NombreEquipoLocal ?? '',
      away: upcoming.NombreEquipoVisitante ?? '',
    });
  }
  return added;
}

/**
 * Requests the upcoming games and saves the raw response to
 * <outputDir>/next-games/<YYYY-MM-DD>.json, then merges the received games
 * into next-games.json in the same directory.
 * @param {import('./api-client').ApiClient} client
 * @param {{days?: number, date?: Date}} [options]
 * @returns {Promise<{data: object, fileName: string, mergedCount: number}>}
 */
async function fetchNextGames(client, { days = DAYS, date = new Date() } = {}) {
  const fileName = `${toDayString(date)}.json`;
  // ApiClient persists the rotated key before returning the data.
  const data = await client.getNextGames({ days });
  await writeJson(client.config.paths.nextGames, fileName, data);

  let accumulated = { mispartidos: [] };
  try {
    accumulated = JSON.parse(await fs.readFile(
      path.join(client.config.paths.nextGames, NEXT_GAMES_FILE), 'utf8',
    ));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (!Array.isArray(accumulated?.mispartidos)) {
    throw new Error(`${NEXT_GAMES_FILE}: expected a mispartidos array.`);
  }
  accumulated.mispartidos = mergeNextGamesList(accumulated.mispartidos, data.mispartidos);
  await writeJson(client.config.paths.nextGames, NEXT_GAMES_FILE, accumulated);
  return { data, fileName, mergedCount: accumulated.mispartidos.length };
}

module.exports = { DAYS, toIsoDate, mergeNewGames, mergeNextGamesList, fetchNextGames };
