'use strict';

/**
 * Builds the anonymized data used by the web (src/data/calendar.json) from the
 * raw downloads. It makes no API requests.
 *
 * - Games come from <outputDir>/games.json (slugs added by hand).
 * - Time, category, clubs and result come from the search results
 *   (<outputDir>/games/**) and next games (<outputDir>/next-games/), matched by
 *   game id. When a game is not found there, the score file is used instead.
 * - Club slugs and logos come from src/data/clubs.json (maintained by hand).
 *
 * Only whitelisted fields are written: no player or coach names, no ids.
 *
 * Usage: node src/build-data.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./core/config');
const { isValidGame, readGamesFile } = require('./core/games');

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
 * Indexes search results and next games by `IdPartido`. Next games are read
 * last, so their (more recent) data wins.
 * @returns {Map<string, object>}
 */
function indexSearchResults(config) {
  const index = new Map();
  const files = [...listJsonFiles(config.paths.games), ...listJsonFiles(config.paths.nextGames)];
  for (const file of files) {
    const json = readJson(file);
    for (const game of json.partidos || json.mispartidos || []) {
      if (game && game.IdPartido) index.set(game.IdPartido, game);
    }
  }
  return index;
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
  const clubs = fs.existsSync(CLUBS_FILE) ? readJson(CLUBS_FILE) : [];
  const bySourceName = new Map();
  for (const club of clubs) {
    for (const sourceName of club.sourceNames || []) {
      bySourceName.set(normalizeName(sourceName), club);
    }
  }
  return bySourceName;
}

function toIsoDate(ddmmyyyy) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy || '');
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
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

function buildSide(clubs, unknownClubs, clubSourceName, teamName, score) {
  const club = clubSourceName ? clubs.get(normalizeName(clubSourceName)) : undefined;
  if (clubSourceName && !club) unknownClubs.add(clubSourceName.trim());
  return {
    club: club ? club.slug : null,
    name: club ? club.name : (clubSourceName || teamName || '').trim(),
    logo: club && club.logo ? club.logo : null,
    team: (teamName || '').trim(),
    score,
  };
}

function fromSearch(game, entry, clubs, unknownClubs) {
  const results = entry.Resultados || {};
  const home = toScore(results.ResultadoLocal);
  const away = toScore(results.ResultadoVisitante);
  return {
    slug: game.slug,
    date: toIsoDate(entry.Fecha) || game.date,
    time: toTime(entry.Hora),
    category: (entry.Categoria || '').trim(),
    played: entry.Estado === 'Terminado' || (home !== null && away !== null),
    home: buildSide(clubs, unknownClubs, entry.NombreClubLocal, entry.NombreEquipoLocal, home),
    away: buildSide(clubs, unknownClubs, entry.NombreClubVisitante, entry.NombreEquipoVisitante, away),
  };
}

function fromScoreFile(game, scoreFile, clubs, unknownClubs) {
  const match = scoreFile ? readJson(scoreFile).partido || {} : {};
  const home = toScore(match.tanteo_local);
  const away = toScore(match.tanteo_visitante);
  return {
    slug: game.slug,
    date: game.date,
    time: null,
    category: '',
    played: match.estado_partido === 'FINALIZADO',
    home: buildSide(clubs, unknownClubs, null, match.local, home),
    away: buildSide(clubs, unknownClubs, null, match.visitante, away),
  };
}

async function main() {
  const config = loadConfig();
  const allGames = (await readGamesFile(config)).games;
  const games = allGames.filter(isValidGame);
  const skipped = allGames.filter((game) => !isValidGame(game)).map((game) => game.slug || '(no slug)');
  const searchIndex = indexSearchResults(config);
  const scoreIndex = indexScoreFiles(config);
  const clubs = loadClubs();

  const unknownClubs = new Set();
  const unmatched = [];
  const calendar = games.map((game) => {
    const entry = searchIndex.get(game.id);
    if (entry) return fromSearch(game, entry, clubs, unknownClubs);
    unmatched.push(game.slug);
    return fromScoreFile(game, scoreIndex.get(game.id), clubs, unknownClubs);
  });

  calendar.sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CALENDAR_FILE, `${JSON.stringify(calendar, null, 2)}\n`, 'utf8');

  console.log(`${calendar.length} games written to ${path.relative(process.cwd(), CALENDAR_FILE)}`);
  if (skipped.length > 0) {
    console.warn(`\n${skipped.length} game(s) skipped (no id yet):`);
    for (const slug of skipped) console.warn(`  - ${slug}`);
  }
  if (unmatched.length > 0) {
    console.warn(`\n${unmatched.length} game(s) not found in search results (no time/category/club):`);
    for (const slug of unmatched) console.warn(`  - ${slug}`);
  }
  if (unknownClubs.size > 0) {
    console.warn(`\n${unknownClubs.size} club(s) missing in ${path.relative(process.cwd(), CLUBS_FILE)}:`);
    for (const name of [...unknownClubs].sort()) console.warn(`  - ${name}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
