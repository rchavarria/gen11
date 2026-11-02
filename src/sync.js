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
 *   1. Renews the API key (ApiClient.renewKey).
 *   2. Requests the upcoming games (21 days), saves the raw response to
 *      <outputDir>/next-games/<YYYY-MM-DD>.json and adds to games.json the
 *      games whose id is not there yet (empty `slug`, with `id` and `date`).
 *      games.json is written right after, so new games are never lost.
 *   3. Manual step (outside this script): put a `slug` to the new games in
 *      games.json. Games without slug are ignored and listed in the report
 *      as pending.
 *   4. Downloads stats and score of the games with id and slug not downloaded
 *      yet (same rules as download-games.js).
 *   5. Generates the Chart.js scored points of the downloaded games
 *      (same rules as scored-points.js).
 *   6. Rebuilds src/data/calendar.json (build-data.js).
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
const { shorterWait } = require('./core/wait');
const { readGamesFile, writeGamesFile } = require('./core/games');
const { fetchNextGames, mergeNewGames, DAYS } = require('./core/next-games');
const download = require('./core/download');
const scoredPoints = require('./core/scored-points');
const { buildCalendar } = require('./build-data');
const { buildReport, writeReport } = require('./core/report');

const SEPARATOR = '='.repeat(50);

function step(text) {
  console.log('');
  console.log(SEPARATOR);
  console.log(text);
  console.log(SEPARATOR);
}

/**
 * Games without slug, described with the data of the upcoming games when known.
 */
function findPendingSlug(data, upcoming) {
  const byId = new Map(upcoming.map((game) => [game.IdPartido, game]));
  return data.games
    .filter((game) => game && typeof game.id === 'string' && game.id.trim() !== '' && String(game.slug || '').trim() === '')
    .map((game) => {
      const info = byId.get(game.id) || {};
      return {
        id: game.id,
        date: game.date,
        home: info.NombreEquipoLocal ?? '',
        away: info.NombreEquipoVisitante ?? '',
      };
    });
}

async function run(config, result) {
  const client = new ApiClient(config);

  step('1. Renewing the API key');
  await client.renewKey();
  console.log('Key renewed.');

  await shorterWait();

  step(`2. Upcoming games (${DAYS} days)`);
  const { data: next, fileName, mergedCount } = await fetchNextGames(client, { days: DAYS, date: result.startedAt });
  console.log(`Games received: ${next.mispartidos.length} (saved to ${fileName})`);
  console.log(`Accumulated games: ${mergedCount} (next-games.json)`);

  const data = await readGamesFile(config);
  result.newGames = mergeNewGames(data, next.mispartidos);
  result.pendingSlug = findPendingSlug(data, next.mispartidos);
  await writeGamesFile(config, data);
  console.log(`New games added to games.json: ${result.newGames.length}`);
  console.log(`Games pending a slug: ${result.pendingSlug.length}`);

  step('3. Download stats and scores');
  try {
    // A request was just sent, so the first download waits first.
    const summary = await download.processGames(client, data, { requestsSent: 1 });
    result.downloaded = summary.downloadedSlugs;
    result.notPlayed = summary.notPlayedSlugs;
    await writeGamesFile(config, data);
    download.printSummary(summary, Date.now() - result.startedAt);
  } catch (err) {
    if (err.summary) {
      result.downloaded = err.summary.downloadedSlugs;
      result.notPlayed = err.summary.notPlayedSlugs;
    }
    throw err;
  }

  step('4. Scored points');
  try {
    const summary = await scoredPoints.processGames(config, data);
    result.scored = summary.scoredSlugs;
    await writeGamesFile(config, data);
    scoredPoints.printSummary(summary, Date.now() - result.startedAt);
  } catch (err) {
    if (err.summary) result.scored = err.summary.scoredSlugs;
    throw err;
  }

  step('5. Calendar (build-data)');
  result.calendarCount = (await buildCalendar(config)).count;
}

async function main() {
  const result = {
    startedAt: new Date(),
    finishedAt: null,
    error: null,
    newGames: [],
    pendingSlug: [],
    downloaded: [],
    notPlayed: [],
    scored: [],
    calendarCount: null,
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
