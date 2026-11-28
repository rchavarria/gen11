'use strict';

/**
 * Upcoming games logic shared by next-games.js and sync.js.
 */

const { writeJson } = require('./files');
const { toDayString } = require('./format');
const { ApiError } = require('./api-client');
const { shorterWait } = require('./wait');
const { loadVenues } = require('./venues');
const { downloadedToUtcIso } = require('./dates');
const {
  CURRENT_SEASON,
  DATA_DIR,
  PENDING,
  allGames,
  teamSlug,
  loadTeams,
  readCompetitionTrees,
  sortTreeGames,
  writeCompetitionTree,
} = require('./competitions');

const DAYS = 100;

function baseCategory(category) {
  return typeof category === 'string' ? category.trim().replace(/ - (?:ORO|PLATA\/BRONCE)$/, '') : undefined;
}

/**
 * Refreshes the date, time and venue of known games (matched by id in every
 * tree, including pending games) and adds new games to `pending-games` of the
 * current-season competition with the same base category. New games without
 * such a competition are discarded. Mutates and sorts the trees.
 * @param {{competition: object, tree: object}[]} trees
 * @param {object[]} upcomingGames The `mispartidos` array of the response.
 * @param {Map<string, string>} venues Exact venue name -> slug.
 * @param {string} [season] Current season.
 * @param {Map<string, {slug: string}>} [teams] Teams indexed by team name.
 * @returns {{added: object[], updated: object[], discarded: object[], unmatchedVenues: string[], invalidDates: object[], changed: Set<object>}}
 *   `added` entries are `{competition, game}`; `changed` holds the modified tree entries.
 */
function mergeNextGames(trees, upcomingGames, venues = new Map(), season = CURRENT_SEASON, teams = new Map()) {
  const byId = new Map();
  for (const entry of trees) {
    for (const game of allGames(entry.tree)) {
      if (game && typeof game.id === 'string' && game.id !== '' && !byId.has(game.id)) {
        byId.set(game.id, { game, entry });
      }
    }
  }

  const added = [];
  const updated = [];
  const discarded = [];
  const unmatchedVenues = new Set();
  const invalidDates = [];
  const changed = new Set();
  for (const upcoming of upcomingGames) {
    const id = upcoming?.IdPartido;
    if (typeof id !== 'string' || id === '') continue;
    const date = downloadedToUtcIso(upcoming.Fecha, upcoming.Hora);
    const venueName = upcoming.CampoJuego;
    const venue = venues.get(venueName) || '';
    if (!venue) unmatchedVenues.add(venueName || '(missing CampoJuego)');
    const known = byId.get(id);
    if (known) {
      const existing = known.game;
      let modified = false;
      if (date && existing.date !== date) {
        existing.date = date;
        modified = true;
      }
      if (venue && existing.venue !== venue) {
        existing.venue = venue;
        modified = true;
      }
      if (modified) {
        if (!updated.includes(existing)) updated.push(existing);
        changed.add(known.entry);
      }
      continue;
    }
    const home = upcoming.NombreEquipoLocal ?? '';
    const away = upcoming.NombreEquipoVisitante ?? '';
    if (!date) {
      invalidDates.push({ id, home, away, fecha: upcoming.Fecha ?? '', hora: upcoming.Hora ?? '' });
      continue;
    }

    const category = String(upcoming.Categoria ?? '').trim();
    const base = baseCategory(category);
    const entry = trees.find(
      ({ competition }) => competition.season === season && baseCategory(competition.category) === base,
    );
    if (!entry) {
      discarded.push({ id, date, home, away, category });
      continue;
    }

    const makeSide = (name) => {
      const slug = teamSlug(teams, name);
      return slug ? { slug, score: null } : { name, score: null };
    };
    const game = {
      id,
      date,
      venue,
      home: makeSide(home),
      away: makeSide(away),
      downloaded: false,
    };
    entry.tree[PENDING].push(game);
    byId.set(id, { game, entry });
    added.push({ competition: entry.competition.id, game });
    changed.add(entry);
  }

  for (const entry of changed) sortTreeGames(entry.tree);
  return { added, updated, discarded, unmatchedVenues: [...unmatchedVenues], invalidDates, changed };
}

/**
 * Requests the upcoming games and saves the raw response to
 * <outputDir>/next-games/<YYYY-MM-DD>.json, then merges the received games
 * into the competition trees (src/data/<competitionId>.json). Only modified
 * trees are written.
 * @param {import('./api-client').ApiClient} client
 * @param {{days?: number, date?: Date, dataDir?: string}} [options]
 * @returns {Promise<{data: object, fileName: string, added: object[], updated: object[], discarded: object[], unmatchedVenues: string[], invalidDates: object[], total: number}>}
 */
async function fetchNextGames(client, { days = DAYS, date = new Date(), dataDir = DATA_DIR } = {}) {
  const fileName = `${toDayString(date)}.json`;
  // ApiClient persists the rotated key before returning the data.
  const data = await client.getNextGames({ days });
  await writeJson(client.config.paths.nextGames, fileName, data);

  const trees = await readCompetitionTrees(dataDir);
  const venues = await loadVenues();
  const teams = await loadTeams(dataDir);
  const { added, updated, discarded, unmatchedVenues, invalidDates, changed } = mergeNextGames(
    trees,
    data.mispartidos,
    venues,
    CURRENT_SEASON,
    teams,
  );
  for (const { competition, tree } of changed) await writeCompetitionTree(competition, tree, dataDir);
  const total = trees.reduce((sum, { tree }) => sum + allGames(tree).length, 0);
  return { data, fileName, added, updated, discarded, unmatchedVenues, invalidDates, total };
}

/**
 * Fetches upcoming games, renewing the key and retrying once on an API error.
 * @param {import('./api-client').ApiClient} client
 * @param {{days?: number, date?: Date, dataDir?: string}} [options]
 * @param {{wait?: () => Promise<void>, onKeyRenewed?: () => void}} [hooks]
 * @returns {Promise<{data: object, fileName: string, added: object[], updated: object[], discarded: object[], unmatchedVenues: string[], invalidDates: object[], total: number, keyRenewed: boolean}>}
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

module.exports = { DAYS, mergeNextGames, fetchNextGames, fetchNextGamesRenewingKey };
