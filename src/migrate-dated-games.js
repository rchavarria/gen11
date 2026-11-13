'use strict';

const fs = require('node:fs/promises');
const { loadConfig } = require('./core/config');
const { isUtcIsoDateTime, madridToUtcIso } = require('./core/dates');

function migrateGames(games) {
  const invalid = [];
  let migrated = 0;
  let alreadyMigrated = 0;
  let unknownTime = 0;
  const result = games.map((game, index) => {
    if (!game || typeof game !== 'object') {
      invalid.push(String(index));
      return game;
    }
    if (!Object.hasOwn(game, 'time') && isUtcIsoDateTime(game.date)) {
      alreadyMigrated += 1;
      return game;
    }
    const date = madridToUtcIso(game.date, game.time);
    if (!date) {
      invalid.push(game.id || String(index));
      return game;
    }
    const { time, ...rest } = game;
    migrated += 1;
    if (date.endsWith('T00:00:00Z')) unknownTime += 1;
    return { ...rest, date };
  });
  if (invalid.length) throw new Error(`Cannot migrate invalid dates: ${invalid.join(', ')}`);
  return { games: result, migrated, alreadyMigrated, unknownTime };
}

async function main() {
  const file = loadConfig().paths.datedGamesFile;
  const raw = await fs.readFile(file, 'utf8');
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data['dated-games'])) throw new Error('Invalid dated-games structure.');
  const result = migrateGames(data['dated-games']);
  if (result.migrated) {
    const backup = `${file}.bak-${Date.now()}`;
    await fs.writeFile(backup, raw, { flag: 'wx' });
    const temp = `${backup}.tmp`;
    let created = false;
    try {
      const handle = await fs.open(temp, 'wx');
      created = true;
      try {
        await handle.writeFile(`${JSON.stringify({ ...data, 'dated-games': result.games }, null, 2)}\n`);
      } finally {
        await handle.close();
      }
      if ((await fs.readFile(file, 'utf8')) !== raw) throw new Error(`File changed during migration: ${file}`);
      await fs.rename(temp, file);
    } finally {
      if (created) await fs.rm(temp, { force: true });
    }
    console.log(`Backup: ${backup}`);
  }
  console.log(
    `Migrated: ${result.migrated}; already migrated: ${result.alreadyMigrated}; unknown time: ${result.unknownTime}`,
  );
}

module.exports = { migrateGames };

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
