'use strict';

/**
 * Builds the web calendar and per-game files from the raw downloads.
 * It makes no API requests.
 *
 * - Games come from the competition trees (src/data/<competitionId>.json),
 *   whose structure is described in src/data/competitions.json. Only games
 *   placed in a round are used; `pending-games` are ignored.
 * - Slugs are computed from the position of each game in the tree:
 *   <competitionId>-<phaseId>[-<groupId>]-<roundId>-<homeClub>-<awayClub>.
 * - The category is the one of the competition.
 * - Scores and played status come from score files (<id>.json), matched by game id.
 * - Club slugs come from src/data/clubs.json (maintained by hand).
 *   The web resolves club names and logos from that file.
 *
 * The calendar only includes whitelisted fields (no ids). Per-game files keep
 * game fields, including ids but excluding source club names and internal
 * download flags, and add scores, period scores and score evolution.
 *
 * Usage: node src/build-data.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./core/config');
const { isValidGame } = require('./core/games');
const { getTimelyScores } = require('./core/timely-scores');
const {
  DATA_DIR,
  computeSlug,
  loadClubs,
  placedGames,
  readCompetitionTrees,
  sideSlug,
} = require('./core/competitions');

const CLUBS_FILE = 'src/data/clubs.json';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listJsonFiles(full);
      return entry.name.endsWith('.json') ? [full] : [];
    })
    .sort();
}

/**
 * Indexes files (<id>.json) in a directory by game id.
 * @returns {Map<string, string>} id -> file path
 */
function indexFilesById(dir) {
  const index = new Map();
  for (const file of listJsonFiles(dir)) {
    const match = path.basename(file, '.json').match(/(?:^|-)([0-9A-F]+)$/);
    if (match) index.set(match[1], file);
  }
  return index;
}

/**
 * Reads the placed games of every competition as flat games with their
 * computed slug and the competition category.
 * @param {string} dataDir
 * @returns {Promise<{games: object[], skipped: string[], clubs: Map<string, object>}>}
 */
async function loadGames(dataDir) {
  const trees = await readCompetitionTrees(dataDir);
  const clubs = await loadClubs(dataDir);
  const games = [];
  const skipped = [];
  for (const { competition, tree } of trees) {
    for (const { game, position } of placedGames(tree)) {
      const slug = computeSlug(competition.id, position, game, clubs);
      if (!isValidGame(game)) {
        skipped.push(slug);
        continue;
      }
      games.push({ slug, venue: game.venue, ...game, category: competition.category });
    }
  }
  return { games, skipped, clubs };
}

function toScore(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

function buildSide(clubs, side, score) {
  const slug = sideSlug(clubs, side);
  if (!slug) {
    throw new Error(
      `Club not found in ${CLUBS_FILE}: "${side?.slug || side?.name || '(missing name)'}". Add the club or its source name to sourceNames.`,
    );
  }
  return {
    club: slug,
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
    venue: game.venue || '',
    category: (game.category || '').trim(),
    played: match.estado_partido === 'FINALIZADO' || (home !== null && away !== null),
    home: buildSide(clubs, game.home, home),
    away: buildSide(clubs, game.away, away),
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

  const { home: homeSource, away: awaySource, downloaded, scored, ...metadata } = game;
  const home = buildSide(clubs, homeSource, homeScore);
  const away = buildSide(clubs, awaySource, awayScore);
  const periods = [...(match.periodos || [])].sort((a, b) => a.periodo - b.periodo);

  const stats = statsData?.estadisticas;
  let timelyScores;
  try {
    timelyScores = getTimelyScores(scoreData);
  } catch (err) {
    timelyScores = { home: [], away: [] };
    console.warn(`Cannot build timely scores for ${game.slug}: ${err.message}`);
  }
  return {
    ...metadata,
    home: {
      slug: home.club,
      score: home.score,
      quarterScores: periods.map((period) => toScore(period.tanteo_periodo_local)),
      ...(stats && { players: toPlayers(stats.estadisticasequipolocal) }),
      timelyScores: timelyScores.home,
    },
    away: {
      slug: away.club,
      score: away.score,
      quarterScores: periods.map((period) => toScore(period.tanteo_periodo_visitante)),
      ...(stats && { players: toPlayers(stats.estadisticasequipovisitante) }),
      timelyScores: timelyScores.away,
    },
  };
}

async function buildGameFiles(config, { dataDir = DATA_DIR } = {}) {
  const { games, clubs } = await loadGames(dataDir);
  const scoreIndex = indexFilesById(config.paths.gamesScores);
  const statsIndex = indexFilesById(config.paths.gamesStats);
  const gamesDir = path.join(dataDir, 'games');
  const slugs = [];

  fs.mkdirSync(gamesDir, { recursive: true });
  for (const game of games) {
    const scoreFile = scoreIndex.get(game.id);
    if (!scoreFile) continue;
    const statsFile = statsIndex.get(game.id);
    const detail = buildGameDetail(game, clubs, readJson(scoreFile), statsFile ? readJson(statsFile) : null);
    if (!detail) continue;
    fs.writeFileSync(path.join(gamesDir, `${game.slug}.json`), `${JSON.stringify(detail, null, 2)}\n`, 'utf8');
    slugs.push(game.slug);
  }

  console.log(`${slugs.length} game files written to ${path.relative(process.cwd(), gamesDir)}`);
  return { count: slugs.length, slugs };
}

async function buildCalendar(config, { dataDir = DATA_DIR } = {}) {
  const { games, skipped, clubs } = await loadGames(dataDir);
  const scoreIndex = indexFilesById(config.paths.gamesScores);
  const calendarFile = path.join(dataDir, 'calendar.json');

  const calendar = games.map((game) => fromDatedGame(game, clubs, scoreIndex.get(game.id)));

  calendar.sort((a, b) => a.date.localeCompare(b.date));

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(calendarFile, `${JSON.stringify(calendar, null, 2)}\n`, 'utf8');

  console.log(`${calendar.length} games written to ${path.relative(process.cwd(), calendarFile)}`);
  if (skipped.length > 0) {
    console.warn(`\n${skipped.length} game(s) skipped (invalid id):`);
    for (const slug of skipped) console.warn(`  - ${slug}`);
  }
  return { count: calendar.length, skipped };
}

module.exports = { toPlayers, buildSide, fromDatedGame, buildGameDetail, buildGameFiles, buildCalendar };

if (require.main === module) {
  Promise.resolve()
    .then(async () => {
      const config = loadConfig();
      await buildCalendar(config);
      await buildGameFiles(config);
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}
