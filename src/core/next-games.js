'use strict';

/**
 * Upcoming games logic shared by next-games.js and sync.js.
 */

const { writeJson } = require('./files');
const { toDayString } = require('./format');

const DAYS = 21;

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
 * <outputDir>/next-games/<YYYY-MM-DD>.json.
 * @param {import('./api-client').ApiClient} client
 * @param {{days?: number, date?: Date}} [options]
 * @returns {Promise<{data: object, fileName: string}>}
 */
async function fetchNextGames(client, { days = DAYS, date = new Date() } = {}) {
  const fileName = `${toDayString(date)}.json`;
  // ApiClient persists the rotated key before returning the data.
  const data = await client.getNextGames({ days });
  await writeJson(client.config.paths.nextGames, fileName, data);
  return { data, fileName };
}

module.exports = { DAYS, toIsoDate, mergeNewGames, fetchNextGames };
