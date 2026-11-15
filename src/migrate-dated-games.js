#!/usr/bin/env node
/**
 * One-off migration from <outputDir>/dated-games.json to the competition game
 * trees (src/data/<competitionId>.json).
 *
 * - dated-games.json is only read, never modified.
 * - Each game is placed in its phase, group and round by parsing its slug
 *   (<competitionId>-<phaseId>[-<groupId>]-<roundId>-<home>-<away>). Games whose
 *   slug does not match the competition structure or the clubs go to
 *   `pending-games` of the current-season competition with the same category.
 * - `slug`, `category` and the legacy `scored` fields are dropped.
 * - Downloaded files <slug>-<id>.json in games-stats/ and games-scores/ are
 *   renamed to <id>.json.
 *
 * Existing tree files are not overwritten unless --force is passed.
 *
 * Usage: node src/migrate-dated-games.js [--force]
 */

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { loadConfig } = require('./core/config');
const {
  CURRENT_SEASON,
  DATA_DIR,
  PENDING,
  clubSlug,
  emptyTree,
  loadClubs,
  readCompetitions,
  sortTreeGames,
  writeCompetitionTree,
} = require('./core/competitions');

// Slugs written by hand before clubs.json existed.
const LEGACY_CLUB_SLUGS = new Map([['real-madrid', 'madrid']]);

function toTreeGame(game) {
  return {
    id: game.id,
    date: game.date,
    venue: game.venue || '',
    ...(game.video && { video: game.video }),
    homeClubName: game.homeClubName ?? '',
    awayClubName: game.awayClubName ?? '',
    downloaded: game.downloaded === true,
  };
}

function clubAliases(clubs, sourceName) {
  const slug = clubSlug(clubs, sourceName);
  if (!slug) return [];
  return [slug, LEGACY_CLUB_SLUGS.get(slug)].filter(Boolean);
}

/**
 * Finds the position of a game from its slug, or null when it does not match.
 * @returns {{competition: object, phase: object, group?: object, round: string}|null}
 */
function locate(game, competitions, clubs) {
  const slug = String(game.slug || '');
  const competition = competitions.find((item) => slug.startsWith(`${item.id}-`));
  if (!competition || competition.category !== String(game.category || '').trim()) return null;
  const parts = slug.slice(competition.id.length + 1).split('-');
  const phaseId = parts.shift();
  const phase = competition.phases.find((item) => item.id === phaseId);
  if (!phase) return null;
  let group;
  if (phase.groups) {
    const groupId = parts.shift();
    group = phase.groups.find((item) => item.id === groupId);
    if (!group) return null;
  }
  const round = parts.shift();
  if (!/^j\d+$/.test(round || '')) return null;
  const teams = parts.join('-');
  const matches = clubAliases(clubs, game.homeClubName).some((home) =>
    clubAliases(clubs, game.awayClubName).some((away) => `${home}-${away}` === teams),
  );
  return matches ? { competition, phase, group, round } : null;
}

function roundNumber(id) {
  return Number.parseInt(id.slice(1), 10);
}

function addToRound(tree, { phase, group, round }, game) {
  const treePhase = tree.phases.find((item) => item.id === phase.id);
  const rounds = group ? treePhase.groups.find((item) => item.id === group.id).rounds : treePhase.rounds;
  let treeRound = rounds.find((item) => item.id === round);
  if (!treeRound) {
    treeRound = { id: round, games: [] };
    rounds.push(treeRound);
    rounds.sort((a, b) => roundNumber(a.id) - roundNumber(b.id));
  }
  treeRound.games.push(game);
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Renames <slug>-<id>.json files to <id>.json (recursively).
 * @returns {Promise<{renamed: number, conflicts: string[]}>}
 */
async function renameDownloads(dir, result = { renamed: 0, conflicts: [] }) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return result;
    throw err;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await renameDownloads(file, result);
      continue;
    }
    const match = entry.name.match(/^.+-([0-9A-F]+)\.json$/);
    if (!match) continue;
    const target = path.join(dir, `${match[1]}.json`);
    if (await fileExists(target)) {
      result.conflicts.push(file);
      continue;
    }
    await fs.rename(file, target);
    result.renamed += 1;
  }
  return result;
}

/**
 * Builds the game trees from the dated games.
 * @returns {{trees: Map<string, object>, pending: object[], discarded: object[]}}
 */
function buildTrees(datedGames, competitions, clubs) {
  const trees = new Map(competitions.map((competition) => [competition.id, emptyTree(competition)]));
  const pending = [];
  const discarded = [];
  for (const game of datedGames) {
    const position = locate(game, competitions, clubs);
    if (position) {
      addToRound(trees.get(position.competition.id), position, toTreeGame(game));
      continue;
    }
    const category = String(game.category || '').trim();
    const competition = competitions.find((item) => item.season === CURRENT_SEASON && item.category === category);
    if (!competition) {
      discarded.push(game);
      continue;
    }
    trees.get(competition.id)[PENDING].push(toTreeGame(game));
    pending.push({ competition: competition.id, game });
  }
  for (const tree of trees.values()) sortTreeGames(tree);
  return { trees, pending, discarded };
}

async function main() {
  const force = process.argv.includes('--force');
  const config = loadConfig();
  const datedGamesFile = path.join(config.outputDir, 'dated-games.json');
  const datedGames = JSON.parse(await fs.readFile(datedGamesFile, 'utf8'))['dated-games'];
  const competitions = await readCompetitions();
  const clubs = await loadClubs();

  for (const competition of competitions) {
    const file = path.join(DATA_DIR, `${competition.id}.json`);
    if (!force && (await fileExists(file))) {
      throw new Error(`${file} already exists. Use --force to overwrite it.`);
    }
  }

  const { trees, pending, discarded } = buildTrees(datedGames, competitions, clubs);
  for (const competition of competitions) {
    await writeCompetitionTree(competition, trees.get(competition.id));
    console.log(`Written: src/data/${competition.id}.json`);
  }
  console.log(`Games read: ${datedGames.length}`);
  for (const { competition, game } of pending) {
    console.warn(`Pending in ${competition}: "${game.slug}" (${game.id})`);
  }
  for (const game of discarded) {
    console.warn(`Discarded (no competition for "${game.category}"): "${game.slug}" (${game.id})`);
  }

  for (const dir of [config.paths.gamesStats, config.paths.gamesScores]) {
    const { renamed, conflicts } = await renameDownloads(dir);
    console.log(`Renamed ${renamed} file(s) in ${dir}`);
    for (const file of conflicts) console.warn(`Not renamed, target exists: ${file}`);
  }
}

module.exports = { buildTrees, renameDownloads };

if (require.main === module) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  });
}
