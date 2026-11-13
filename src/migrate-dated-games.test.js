import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { migrateGames } from './migrate-dated-games.js';

test('migrates all games, preserves metadata and is idempotent', () => {
  const games = [
    { id: 'A', date: '2026-11-06', time: '18:30:00', video: 'video', downloaded: true },
    { id: 'B', date: '2026-05-10', time: '11:30:00', venue: 'central' },
    { id: 'C', date: '2026-11-07', time: '00:00:00' },
    { id: 'D', date: '2026-11-08T09:00:00Z' },
  ];
  const before = structuredClone(games);
  const result = migrateGames(games);
  assert.deepEqual(result, {
    games: [
      { id: 'A', date: '2026-11-06T17:30:00Z', video: 'video', downloaded: true },
      { id: 'B', date: '2026-05-10T09:30:00Z', venue: 'central' },
      { id: 'C', date: '2026-11-07T00:00:00Z' },
      { id: 'D', date: '2026-11-08T09:00:00Z' },
    ],
    migrated: 3,
    alreadyMigrated: 1,
    unknownTime: 1,
  });
  assert.deepEqual(games, before);
  assert.deepEqual(migrateGames(result.games), {
    games: result.games,
    migrated: 0,
    alreadyMigrated: 4,
    unknownTime: 0,
  });
});

test('refuses invalid dates without changing the source', () => {
  const games = [{ id: 'BAD', date: '2026-02-31', time: '10:00:00' }];
  assert.throws(() => migrateGames(games), /BAD/);
  assert.deepEqual(games, [{ id: 'BAD', date: '2026-02-31', time: '10:00:00' }]);
});

test('migration CLI backs up the source, replaces it safely and does not back up again', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gen11-migrate-'));
  t.onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src/core'), { recursive: true });
  fs.mkdirSync(path.join(root, 'downloads'));
  for (const file of ['migrate-dated-games.js', 'core/config.js', 'core/dates.js']) {
    fs.copyFileSync(path.join(import.meta.dirname, file), path.join(root, 'src', file));
  }
  fs.writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ baseUrl: 'https://example.test', deviceId: 'test', key: 'test', outputDir: './downloads' }),
  );
  const file = path.join(root, 'downloads/dated-games.json');
  const invalid = JSON.stringify({ 'dated-games': [{ id: 'BAD', date: 'invalid', time: '' }] });
  fs.writeFileSync(file, invalid);
  assert.throws(() =>
    execFileSync(process.execPath, [path.join(root, 'src/migrate-dated-games.js')], { stdio: 'pipe' }),
  );
  assert.equal(fs.readFileSync(file, 'utf8'), invalid);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['dated-games.json']);

  const original = JSON.stringify({ 'dated-games': [{ id: 'A', date: '2026-05-10', time: '11:30:00' }] });
  fs.writeFileSync(file, original);
  execFileSync(process.execPath, [path.join(root, 'src/migrate-dated-games.js')]);
  const backups = fs.readdirSync(path.dirname(file)).filter((name) => name.startsWith('dated-games.json.bak-'));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(path.dirname(file), backups[0]), 'utf8'), original);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8'))['dated-games'], [
    { id: 'A', date: '2026-05-10T09:30:00Z' },
  ]);
  execFileSync(process.execPath, [path.join(root, 'src/migrate-dated-games.js')]);
  assert.equal(fs.readdirSync(path.dirname(file)).length, 2);
});
