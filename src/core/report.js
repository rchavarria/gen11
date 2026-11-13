'use strict';

/**
 * Final report of sync.js: markdown text and file writing.
 */

const fs = require('node:fs/promises');
const path = require('node:path');

const { formatDuration, timestamp, toDayString } = require('./format');
const { formatGameDate } = require('./dates');

function section(title, items) {
  const lines = [`## ${title} (${items.length})`, ''];
  if (items.length === 0) lines.push('_None._');
  else lines.push(...items.map((item) => `- ${item}`));
  lines.push('');
  return lines;
}

function describeGame(game) {
  const teams = game.home || game.away ? `${game.home} vs ${game.away}` : '(unknown teams)';
  return `${formatGameDate(game.date)} — ${teams} — \`${game.id}\``;
}

/**
 * Builds the markdown report.
 * @param {{
 *   startedAt: Date, finishedAt: Date, error?: string|null, keyRenewed?: boolean,
 *   newGames: object[], pendingSlug: object[],
 *   downloaded: string[], notPlayed: string[],
 *   calendarCount?: number|null, gameFilesCount?: number|null
 * }} result
 * @returns {string}
 */
function buildReport(result) {
  const lines = [
    `# Sync report ${toDayString(result.startedAt)}`,
    '',
    `- Started: ${timestamp(result.startedAt)}`,
    `- Finished: ${timestamp(result.finishedAt)}`,
    `- Duration: ${formatDuration(result.finishedAt - result.startedAt)}`,
    `- Status: ${result.error ? 'FAILED' : 'OK'}`,
    `- Key renewed: ${result.keyRenewed ? 'yes' : 'no'}`,
  ];
  if (result.error) lines.push(`- Error: ${result.error}`);
  lines.push('');

  lines.push(...section('New games', result.newGames.map(describeGame)));
  lines.push(
    ...section(
      'New games skipped due to invalid dates',
      (result.invalidDates || []).map(
        (game) => `${game.fecha || '(no date)'} ${game.hora || ''} — ${game.home} vs ${game.away} — \`${game.id}\``,
      ),
    ),
  );
  lines.push(...section('Games pending a slug (edit dated-games.json)', result.pendingSlug.map(describeGame)));
  lines.push(...section('Downloaded games', result.downloaded));
  lines.push(...section('Games without data yet ("sin datos")', result.notPlayed));
  if (result.calendarCount != null) lines.push(`Calendar: ${result.calendarCount} game(s) written.`, '');
  if (result.gameFilesCount != null) lines.push(`Game files: ${result.gameFilesCount} written.`, '');

  return lines.join('\n');
}

/**
 * Writes the report to <outputDir>/sync-reports/<YYYY-MM-DD>.md.
 * @param {{paths: {syncReports: string}}} config
 * @param {Date} date
 * @param {string} text
 * @returns {Promise<string>} The file path.
 */
async function writeReport(config, date, text) {
  await fs.mkdir(config.paths.syncReports, { recursive: true });
  const file = path.join(config.paths.syncReports, `${toDayString(date)}.md`);
  await fs.writeFile(file, `${text}\n`, 'utf8');
  return file;
}

module.exports = { buildReport, writeReport };
