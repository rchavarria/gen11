'use strict';

/**
 * Competitions: structure (src/data/competitions.json, maintained by hand) and
 * game trees (src/data/<competitionId>.json, maintained by sync).
 *
 * Game tree file:
 *   { "phases": [ { "id", "groups": [ { "id", "rounds": [ { "id", "games": [...] } ] } ] } ],
 *     "pending-games": [...] }
 * Phases without groups hold `rounds` directly. Games are identified by `id`
 * (IdPartido). Their slug is computed from their position in the tree.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { writeJson } = require('./files');
const { isUtcIsoDateTime } = require('./dates');

const CURRENT_SEASON = 's67';
const DATA_DIR = path.join(__dirname, '..', 'data');
const COMPETITIONS_FILE = 'competitions.json';
const CLUBS_FILE = 'clubs.json';
const PENDING = 'pending-games';

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toUpperCase();
}

async function readJsonFile(file) {
  const raw = await fs.readFile(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${file}: ${err.message}`);
  }
}

/**
 * Reads src/data/competitions.json.
 * @param {string} [dataDir]
 * @returns {Promise<object[]>}
 */
async function readCompetitions(dataDir = DATA_DIR) {
  const file = path.join(dataDir, COMPETITIONS_FILE);
  const data = await readJsonFile(file);
  if (!Array.isArray(data?.competitions)) {
    throw new Error(`Invalid structure in ${file}: "competitions" array is missing.`);
  }
  for (const competition of data.competitions) {
    if (typeof competition?.id !== 'string' || !Array.isArray(competition.phases)) {
      throw new Error(`Invalid competition in ${file}: "id" and "phases" are required.`);
    }
  }
  return data.competitions;
}

/**
 * Club lookup by source name (from src/data/clubs.json).
 * @param {string} [dataDir]
 * @returns {Promise<Map<string, {slug: string}>>} normalized source name and slug index -> club
 */
async function loadClubs(dataDir = DATA_DIR) {
  const clubs = await readJsonFile(path.join(dataDir, CLUBS_FILE));
  const bySourceName = new Map();
  for (const club of clubs) {
    bySourceName.set(`\0${club.slug}`, club);
    for (const sourceName of club.sourceNames || []) {
      bySourceName.set(normalizeName(sourceName), club);
    }
  }
  return bySourceName;
}

/**
 * Returns an empty game tree with the phases and groups of the competition.
 * @param {object} competition
 */
function emptyTree(competition) {
  return {
    phases: competition.phases.map((phase) =>
      phase.groups
        ? { id: phase.id, groups: phase.groups.map((group) => ({ id: group.id, rounds: [] })) }
        : { id: phase.id, rounds: [] },
    ),
    [PENDING]: [],
  };
}

function competitionFile(dataDir, competitionId) {
  return path.join(dataDir, `${competitionId}.json`);
}

function* roundsOf(tree) {
  for (const phase of tree.phases) {
    if (phase.groups) {
      for (const group of phase.groups) {
        for (const round of group.rounds) yield { round, position: { phase: phase.id, group: group.id } };
      }
    } else {
      for (const round of phase.rounds) yield { round, position: { phase: phase.id } };
    }
  }
}

function validateTree(tree, competition, file) {
  const fail = (message) => {
    throw new Error(`Invalid structure in ${file}: ${message}`);
  };
  if (tree === null || typeof tree !== 'object' || !Array.isArray(tree.phases) || !Array.isArray(tree[PENDING])) {
    fail(`"phases" and "${PENDING}" arrays are required.`);
  }
  for (const phase of tree.phases) {
    const known = competition.phases.find((item) => item.id === phase?.id);
    if (!known) fail(`unknown phase "${phase?.id}".`);
    if (known.groups) {
      if (!Array.isArray(phase.groups)) fail(`phase "${phase.id}" needs a "groups" array.`);
      for (const group of phase.groups) {
        if (!known.groups.some((item) => item.id === group?.id)) fail(`unknown group "${phase.id}-${group?.id}".`);
        if (!Array.isArray(group.rounds)) fail(`group "${phase.id}-${group.id}" needs a "rounds" array.`);
      }
    } else if (!Array.isArray(phase.rounds)) {
      fail(`phase "${phase.id}" needs a "rounds" array.`);
    }
  }
  const games = [...tree[PENDING]];
  for (const { round, position } of roundsOf(tree)) {
    const where = [position.phase, position.group, round?.id].filter(Boolean).join('-');
    if (typeof round?.id !== 'string' || round.id === '' || !Array.isArray(round.games)) {
      fail(`round "${where}" needs an "id" and a "games" array.`);
    }
    games.push(...round.games);
  }
  if (games.some((game) => !game || !isUtcIsoDateTime(game.date))) {
    fail('invalid UTC date; use YYYY-MM-DDTHH:mm:ssZ.');
  }
}

/**
 * Reads the game tree of a competition. A missing file returns an empty tree.
 * @param {object} competition
 * @param {string} [dataDir]
 */
async function readCompetitionTree(competition, dataDir = DATA_DIR) {
  const file = competitionFile(dataDir, competition.id);
  let tree;
  try {
    tree = await readJsonFile(file);
  } catch (err) {
    if (err.code === 'ENOENT') return emptyTree(competition);
    throw err;
  }
  validateTree(tree, competition, file);
  return tree;
}

/**
 * Reads every competition with its game tree.
 * @param {string} [dataDir]
 * @returns {Promise<{competition: object, tree: object}[]>}
 */
async function readCompetitionTrees(dataDir = DATA_DIR) {
  const competitions = await readCompetitions(dataDir);
  return Promise.all(
    competitions.map(async (competition) => ({ competition, tree: await readCompetitionTree(competition, dataDir) })),
  );
}

/**
 * Writes the game tree of a competition to src/data/<competitionId>.json.
 */
async function writeCompetitionTree(competition, tree, dataDir = DATA_DIR) {
  await writeJson(dataDir, path.basename(competitionFile(dataDir, competition.id)), tree);
}

/**
 * Games placed in rounds, with their position.
 * @returns {{game: object, position: {phase: string, group?: string, round: string}}[]}
 */
function placedGames(tree) {
  const result = [];
  for (const { round, position } of roundsOf(tree)) {
    for (const game of round.games) result.push({ game, position: { ...position, round: round.id } });
  }
  return result;
}

/**
 * Every game of the tree: placed games and pending games.
 * @returns {object[]}
 */
function allGames(tree) {
  return [...placedGames(tree).map(({ game }) => game), ...tree[PENDING]];
}

/**
 * Club slug for a source club name.
 * @param {Map<string, {slug: string}>} clubs
 * @param {string} sourceName
 * @returns {string|null}
 */
function clubSlug(clubs, sourceName) {
  return clubs.get(normalizeName(sourceName))?.slug ?? null;
}

function sideSlug(clubs, side) {
  if (side?.slug) {
    return clubs.get(`\0${side.slug}`)?.slug === side.slug ||
      [...clubs.values()].some((club) => club.slug === side.slug)
      ? side.slug
      : null;
  }
  return clubSlug(clubs, side?.name);
}

/**
 * Builds the slug of a placed game:
 * <competitionId>-<phaseId>[-<groupId>]-<roundId>-<homeClubSlug>-<awayClubSlug>.
 * Throws when a club is not in clubs.json.
 */
function computeSlug(competitionId, position, game, clubs) {
  const sides = [game.home, game.away].map((side) => {
    const slug = sideSlug(clubs, side);
    if (!slug) {
      throw new Error(
        `Club not found in ${CLUBS_FILE}: "${side?.slug || side?.name || '(missing name)'}". Add the club or its source name to sourceNames.`,
      );
    }
    return slug;
  });
  return [competitionId, position.phase, position.group, position.round, ...sides].filter(Boolean).join('-');
}

/**
 * Every game of every tree. Placed games carry their position; pending ones a
 * null position. `label` is the computed slug when the clubs are known, or a
 * readable description otherwise.
 * @param {{competition: object, tree: object}[]} trees
 * @param {Map<string, {slug: string}>} clubs
 * @returns {{competition: object, game: object, position: object|null, label: string}[]}
 */
function listGames(trees, clubs) {
  const describe = (competition, game, suffix) =>
    `${competition.id} ${suffix}: ${game.home?.slug || game.home?.name || '?'} vs ${game.away?.slug || game.away?.name || '?'} (${game.id})`;
  const result = [];
  for (const { competition, tree } of trees) {
    for (const { game, position } of placedGames(tree)) {
      let label;
      try {
        label = computeSlug(competition.id, position, game, clubs);
      } catch {
        label = describe(competition, game, [position.phase, position.group, position.round].filter(Boolean).join('-'));
      }
      result.push({ competition, game, position, label });
    }
    for (const game of tree[PENDING]) {
      result.push({ competition, game, position: null, label: describe(competition, game, 'pending') });
    }
  }
  return result;
}

/**
 * Compares games by UTC date; invalid or missing dates go last.
 */
function compareByDate(a, b) {
  const aDate = isUtcIsoDateTime(a.date);
  const bDate = isUtcIsoDateTime(b.date);
  if (aDate !== bDate) return aDate ? -1 : 1;
  return (a.date || '').localeCompare(b.date || '');
}

/**
 * Sorts the games of every round and the pending games by date.
 */
function sortTreeGames(tree) {
  for (const { round } of roundsOf(tree)) round.games.sort(compareByDate);
  tree[PENDING].sort(compareByDate);
}

module.exports = {
  CURRENT_SEASON,
  DATA_DIR,
  PENDING,
  normalizeName,
  readCompetitions,
  loadClubs,
  emptyTree,
  readCompetitionTree,
  readCompetitionTrees,
  writeCompetitionTree,
  placedGames,
  allGames,
  clubSlug,
  sideSlug,
  computeSlug,
  listGames,
  compareByDate,
  sortTreeGames,
};
