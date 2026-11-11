#!/usr/bin/env node
/**
 * =============================================================================
 * README
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Runs the whole data pipeline in one go, reusing the code of the individual
 * scripts (src/core/):
 *
 *   1. Requests the upcoming games (`DAYS` days), renewing the API key and
 *      retrying once if the API returns an error. Saves the raw response to
 *      <outputDir>/next-games/<YYYY-MM-DD>.json and consolidates upcoming
 *      games into <outputDir>/dated-games.json.
 *   2. Manual step (outside this script): put a `slug` to the new games in
 *      dated-games.json. Games without slug are ignored and listed in the report.
 *   3. Downloads stats and score of the games with id and slug not downloaded
 *      yet (same rules as download-games.js).
 *   4. Generates the Chart.js scored points of the downloaded games
 *      (same rules as scored-points.js).
 *   5. Rebuilds src/data/calendar.json (build-data.js).
 *   6. Rebuilds src/data/games/<slug>.json for games with scores, including
 *      each team's timelyScores (score evolution from the raw actions).
 *   7. Writes the report to <outputDir>/sync-reports/<YYYY-MM-DD>.md (an
 *      existing report of the same day is overwritten) and prints it.
 *
 * Requests are sent strictly sequentially, with a random pause between them
 * (shortWait() in src/core/wait.js). On any error the pipeline aborts
 * (exit code 1), but the report is still written with what was done so far.
 *
 * EXECUTION EXAMPLE
 * -----------------
 *   node src/sync.js        (or: npm run sync)
 * =============================================================================
 */

'use strict';

const { ApiClient } = require('./core/api-client');
const { loadConfig } = require('./core/config');
const { readDatedGamesFile, writeDatedGamesFile } = require('./core/dated-games');
const { fetchNextGamesRenewingKey, DAYS } = require('./core/next-games');
const download = require('./core/download');
const scoredPoints = require('./core/scored-points');
const { buildCalendar, buildGameFiles } = require('./build-data');
const { buildReport, writeReport } = require('./core/report');

const SEPARATOR = '='.repeat(50);

function step(text) {
  console.log('');
  console.log(SEPARATOR);
  console.log(text);
  console.log(SEPARATOR);
}

/**
 * Games without slug in dated-games.json.
 */
function findPendingSlug(games) {
  return games
    .filter(
      (game) => game && typeof game.id === 'string' && game.id.trim() !== '' && String(game.slug || '').trim() === '',
    )
    .map((game) => ({
      id: game.id,
      date: game.date,
      home: game.homeClubName ?? '',
      away: game.awayClubName ?? '',
    }));
}

async function run(config, result) {
  const client = new ApiClient(config);

  step(`1. Upcoming games (${DAYS} days)`);
  const {
    data: next,
    fileName,
    added,
    updated,
    total,
    keyRenewed,
  } = await fetchNextGamesRenewingKey(
    client,
    { days: DAYS, date: result.startedAt },
    {
      onKeyRenewed: () => {
        result.keyRenewed = true;
      },
    },
  );
  result.keyRenewed = keyRenewed;
  console.log(`Games received: ${next.mispartidos.length} (saved to ${fileName})`);
  console.log(`Dated games added: ${added.length}`);
  console.log(`Dated games updated: ${updated.length}`);
  console.log(`Total dated games: ${total}`);

  const data = await readDatedGamesFile(config);
  const games = data['dated-games'];
  result.newGames = added.map((game) => ({
    id: game.id,
    date: game.date,
    home: game.homeClubName,
    away: game.awayClubName,
  }));
  result.pendingSlug = findPendingSlug(games);
  console.log(`New games added to dated-games.json: ${result.newGames.length}`);
  console.log(`Games pending a slug: ${result.pendingSlug.length}`);

  step('2. Download stats and scores');
  try {
    // A request was just sent, so the first download waits first.
    const summary = await download.processGames(client, games, { requestsSent: 1 });
    result.downloaded = summary.downloadedSlugs;
    result.notPlayed = summary.notPlayedSlugs;
    await writeDatedGamesFile(config, data);
    download.printSummary(summary, Date.now() - result.startedAt);
  } catch (err) {
    if (err.summary) {
      result.downloaded = err.summary.downloadedSlugs;
      result.notPlayed = err.summary.notPlayedSlugs;
    }
    throw err;
  }

  step('3. Scored points');
  try {
    const summary = await scoredPoints.processGames(config, games);
    result.scored = summary.scoredSlugs;
    await writeDatedGamesFile(config, data);
    scoredPoints.printSummary(summary, Date.now() - result.startedAt);
  } catch (err) {
    if (err.summary) result.scored = err.summary.scoredSlugs;
    throw err;
  }

  step('4. Calendar (build-data)');
  result.calendarCount = (await buildCalendar(config)).count;

  step('5. Game files');
  result.gameFilesCount = (await buildGameFiles(config)).count;
}

async function main() {
  const result = {
    startedAt: new Date(),
    finishedAt: null,
    error: null,
    keyRenewed: false,
    newGames: [],
    pendingSlug: [],
    downloaded: [],
    notPlayed: [],
    scored: [],
    calendarCount: null,
    gameFilesCount: null,
  };

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    await run(config, result);
  } catch (err) {
    result.error = err.message;
    process.exitCode = 1;
    console.error(`Error: ${err.message}`);
  }

  result.finishedAt = new Date();
  const text = buildReport(result);
  console.log('');
  console.log(text);
  try {
    console.log(`Report saved: ${await writeReport(config, result.startedAt, text)}`);
  } catch (err) {
    console.error(`Cannot write the report: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
