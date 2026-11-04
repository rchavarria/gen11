'use strict';

/**
 * Builds the web calendar and per-game files from the raw downloads.
 * It makes no API requests.
 *
 * - Games, dates, times, categories and clubs come from
 *   <outputDir>/dated-games.json (slugs added by hand).
 * - Scores and played status come from score files, matched by game id.
 * - Club slugs come from src/data/clubs.json (maintained by hand).
 *   The web resolves club names and logos from that file.
 *
 * The calendar only includes whitelisted fields (no ids). Per-game files keep
 * dated-game fields, including ids but excluding source club names and internal
 * download/scoring flags, and add scores and period scores.
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
const GAMES_DIR = path.join(DATA_DIR, 'games');

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
 * Indexes files (<slug>-<id>.json) in a directory by game id.
 * @returns {Map<string, string>} id -> file path
 */
function indexFilesById(dir) {
  const index = new Map();
  for (const file of listJsonFiles(dir)) {
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

function toPlayer(raw) {
  return {
    jersey: raw.dorsal,
    msPlayed: raw.milisegundos_jugados,
    starter: raw.quintetotitular,
    freeThrows: { made: raw.canasta1p, attempted: raw.tiro1p },
    twoPointers: { made: raw.canasta2p, attempted: raw.tiro2p },
    threePointers: { made: raw.canasta3p, attempted: raw.tiro3p },
    rebounds: { defensive: raw.rebotedefensivo, offensive: raw.reboteofensivo },
    assists: raw.asistencias,
    turnovers: raw.perdidas,
    steals: raw.recuperaciones,
    blocks: { made: raw.taponescometidos, received: raw.taponesrecibidos },
    fouls: { committed: raw.faltascometidas, received: raw.faltasrecibidas },
    plusMinus: raw.masMenos,
    efficiency: raw.valoracion,
  };
}

// The source appends a "TOTALES" row (empty jersey, no player id) to each team.
function toPlayers(list) {
  return (list || []).filter((raw) => raw.nombre !== 'TOTALES').map(toPlayer);
}

function buildGameDetail(game, clubs, scoreData, statsData) {
  const match = scoreData?.partido || {};
  const homeScore = toScore(match.tanteo_local);
  const awayScore = toScore(match.tanteo_visitante);
  if (homeScore === null || awayScore === null) return null;

  const { homeClubName, awayClubName, downloaded, scored, ...metadata } = game;
  const home = buildSide(clubs, homeClubName, homeScore);
  const away = buildSide(clubs, awayClubName, awayScore);
  const periods = [...(match.periodos || [])].sort((a, b) => a.periodo - b.periodo);

  const stats = statsData?.estadisticas;
  return {
    ...metadata,
    home: {
      slug: home.club,
      score: home.score,
      quarterScores: periods.map((period) => toScore(period.tanteo_periodo_local)),
      ...(stats && { players: toPlayers(stats.estadisticasequipolocal) }),
    },
    away: {
      slug: away.club,
      score: away.score,
      quarterScores: periods.map((period) => toScore(period.tanteo_periodo_visitante)),
      ...(stats && { players: toPlayers(stats.estadisticasequipovisitante) }),
    },
  };
}

async function buildGameFiles(config) {
  const games = (await readDatedGamesFile(config))['dated-games'].filter(isValidGame);
  const scoreIndex = indexFilesById(config.paths.gamesScores);
  const statsIndex = indexFilesById(config.paths.gamesStats);
  const clubs = loadClubs();
  const slugs = [];

  fs.mkdirSync(GAMES_DIR, { recursive: true });
  for (const game of games) {
    const scoreFile = scoreIndex.get(game.id);
    if (!scoreFile) continue;
    const statsFile = statsIndex.get(game.id);
    const detail = buildGameDetail(game, clubs, readJson(scoreFile), statsFile ? readJson(statsFile) : null);
    if (!detail) continue;
    fs.writeFileSync(path.join(GAMES_DIR, `${game.slug}.json`), `${JSON.stringify(detail, null, 2)}\n`, 'utf8');
    slugs.push(game.slug);
  }

  console.log(`${slugs.length} game files written to ${path.relative(process.cwd(), GAMES_DIR)}`);
  return { count: slugs.length, slugs };
}

async function buildCalendar(config) {
  const allGames = (await readDatedGamesFile(config))['dated-games'];
  const games = allGames.filter(isValidGame);
  const skipped = allGames.filter((game) => !isValidGame(game)).map((game) => game.slug || '(no slug)');
  const scoreIndex = indexFilesById(config.paths.gamesScores);
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

module.exports = { toPlayers, buildSide, fromDatedGame, buildGameDetail, buildGameFiles, buildCalendar };

if (require.main === module) {
  Promise.resolve().then(async () => {
    const config = loadConfig();
    await buildCalendar(config);
    await buildGameFiles(config);
  }).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
