'use strict';

/**
 * Builds the anonymized data used by the web (src/data/calendar.json) from the
 * raw downloads. It makes no API requests.
 *
 * - Games, dates, times, categories and clubs come from
 *   <outputDir>/dated-games.json (slugs added by hand).
 * - Scores and played status come from score files, matched by game id.
 * - Club slugs come from src/data/clubs.json (maintained by hand).
 *   The web resolves club names and logos from that file.
 *
 * Only whitelisted fields are written: no player or coach names, no ids.
 *
 * Usage: node src/build-data.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./core/config');
const { isValidGame } = require('./core/games');
const { readDatedGamesFile } = require('./core/dated-games');

const DATA_DIR = path.join(__dirname, 'data');
const CLUBS_FILE = path.join(DATA_DIR, 'clubs.json');
const CALENDAR_FILE = path.join(DATA_DIR, 'calendar.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listJsonFiles(full);
      return entry.name.endsWith('.json') ? [full] : [];
    })
    .sort();
}

/**
 * Indexes score files (<slug>-<id>.json) by game id.
 * @returns {Map<string, string>} id -> file path
 */
function indexScoreFiles(config) {
  const index = new Map();
  for (const file of listJsonFiles(config.paths.gamesScores)) {
    const match = path.basename(file, '.json').match(/-([0-9A-F]+)$/);
    if (match) index.set(match[1], file);
  }
  return index;
}

function normalizeName(name) {
  return String(name || '').trim().toUpperCase();
}

/**
 * @returns {Map<string, {slug: string, name: string, logo: string|null}>} source name -> club
 */
function loadClubs() {
  const clubs = readJson(CLUBS_FILE);
  const bySourceName = new Map();
  for (const club of clubs) {
    for (const sourceName of club.sourceNames || []) {
      bySourceName.set(normalizeName(sourceName), club);
    }
  }
  return bySourceName;
}

function toTime(hhmmss) {
  const match = /^(\d{2}):(\d{2})/.exec(hhmmss || '');
  if (!match || (match[1] === '00' && match[2] === '00')) return null;
  return `${match[1]}:${match[2]}`;
}

function toScore(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

function buildSide(clubs, clubSourceName, score) {
  const club = clubs.get(normalizeName(clubSourceName));
  if (!club) {
    throw new Error(`Club not found in ${CLUBS_FILE}: "${clubSourceName || '(missing name)'}". Add its source name to sourceNames.`);
  }
  return {
    club: club.slug,
    score,
  };
}

function fromDatedGame(game, clubs, scoreFile) {
  const match = scoreFile ? readJson(scoreFile).partido || {} : {};
  const home = toScore(match.tanteo_local);
  const away = toScore(match.tanteo_visitante);
  return {
    slug: game.slug,
    date: game.date,
    time: toTime(game.time),
    category: (game.category || '').trim(),
    played: match.estado_partido === 'FINALIZADO' || (home !== null && away !== null),
    home: buildSide(clubs, game.homeClubName, home),
    away: buildSide(clubs, game.awayClubName, away),
  };
}

async function buildCalendar(config) {
  const allGames = (await readDatedGamesFile(config))['dated-games'];
  const games = allGames.filter(isValidGame);
  const skipped = allGames.filter((game) => !isValidGame(game)).map((game) => game.slug || '(no slug)');
  const scoreIndex = indexScoreFiles(config);
  const clubs = loadClubs();

  const calendar = games.map((game) => fromDatedGame(game, clubs, scoreIndex.get(game.id)));

  calendar.sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CALENDAR_FILE, `${JSON.stringify(calendar, null, 2)}\n`, 'utf8');

  console.log(`${calendar.length} games written to ${path.relative(process.cwd(), CALENDAR_FILE)}`);
  if (skipped.length > 0) {
    console.warn(`\n${skipped.length} game(s) skipped (missing slug or invalid id):`);
    for (const slug of skipped) console.warn(`  - ${slug}`);
  }
  return { count: calendar.length, skipped };
}

module.exports = { buildSide, fromDatedGame, buildCalendar };

if (require.main === module) {
  Promise.resolve().then(() => buildCalendar(loadConfig())).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
