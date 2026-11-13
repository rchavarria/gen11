# 2011 generation

Gather basket players data born on 2011

## Configuration

Scripts read their configuration from `config.json` at the project root
(ignored by git). Copy the example and fill in your values:

```bash
cp config.example.json config.json
```

| Key         | Required | Description                                                                               |
| ----------- | -------- | ----------------------------------------------------------------------------------------- |
| `baseUrl`   | yes      | Base URL of the API                                                                       |
| `deviceId`  | yes      | Registered device id, sent as `id_dispositivo`                                            |
| `key`       | yes      | Key sent as `key` (`api-client.js` rotates the key whenever a response returns a new one) |
| `outputDir` | no       | Root download directory, relative to the project root (default `.`)                       |

Each script writes into its own subfolder of `outputDir`:

| Script              | Output                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| `previous-games.js` | `<outputDir>/games/`                                                          |
| `download-games.js` | `<outputDir>/dated-games.json`, `games-stats/`, `games-scores/`               |
| `next-games.js`     | `<outputDir>/next-games/<YYYY-MM-DD>.json`, `dated-games.json`                |
| `build-data.js`     | `src/data/calendar.json`, `src/data/games/<slug>.json` (data for the web)     |
| `sync.js`           | `<outputDir>/sync-reports/<YYYY-MM-DD>.md` (plus everything above, see below) |

## Usage

```bash
node src/previous-games.js <startPage> <totalPages>
node src/download-games.js
node src/next-games.js
node src/renew-key.js
node src/build-data.js
npm run sync   # same as: node src/sync.js
```

`sync.js` runs the whole pipeline: fetch upcoming games and add the new ones
to `dated-games.json` (empty `slug`); if that request fails with an API error,
it renews the key and retries once. It also updates dates and times of known
games, downloads stats/scores, rebuilds `calendar.json` and per-game files,
including each game's score evolution, and writes a report. Setting the `slug` of
new games in `dated-games.json` is a manual step: games without a slug are
ignored and listed in the report as pending until you fill it in and run
`sync` again.

Game `date` fields use UTC ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`), converted from
Europe/Madrid. The UI displays Madrid dates and times. `T00:00:00Z` represents an
unknown time on that calendar day; a real time converting to midnight UTC is
indistinguishable from that marker. Missing or invalid source dates for new games
are reported and skipped. Ambiguous Madrid times during the autumn clock change
use the earlier occurrence; nonexistent times during the spring change are rejected.

To migrate an existing `<outputDir>/dated-games.json`, run
`node src/migrate-dated-games.js` before sync or build-data. It saves a backup next
to the original, converts all legacy `date`/`time` entries, and can be run again
safely. Invalid dates abort the migration without replacing the original.

`build-data.js` reads game metadata from `dated-games.json` and scores from
`games-scores/`. Without a score file, games are shown as not played.
For games with both numeric scores, it also rewrites `src/data/games/<slug>.json`.
These files preserve dated-game fields, including `id`, but omit `homeClubName`,
`awayClubName`, `downloaded` and `scored`. They add `home` and `away` objects with the club `slug`, `score`, and numeric
`quarterScores` ordered by period (including overtime). Club slugs are resolved
through `sourceNames` in `clubs.json`; unknown clubs cause an error.
If `games-stats/<slug>-<id>.json` exists, `home` and `away` also get `players`: one entry per player
(the source's `TOTALES` row is excluded) with `jersey`, `msPlayed`, `starter`, `freeThrows`, `twoPointers`,
`threePointers` (`made`/`attempted`), `rebounds` (`defensive`/`offensive`), `assists`, `turnovers`, `steals`,
`blocks` (`made`/`received`), `fouls` (`committed`/`received`), `plusMinus` and `efficiency`.
Each side also gets `timelyScores`: `{time, score, jersey}` entries extracted from
`games-scores/` actions, with elapsed game time in milliseconds, accumulated team score
and the scorer's jersey. Entries start at `{time: 0, score: 0, jersey: null}` and are
ordered by time, then total score for ties. Regular periods last 10 minutes and overtime
periods 5 minutes. Missing or invalid action data produces empty arrays for both teams
and a warning identifying the game. A valid empty history retains only the initial points.

## Web

Static React + Vite site in `src/web/`, published to GitHub Pages on every push
to `main` (`.github/workflows/pages.yml`). See [web design](docs/web-design.md).

```bash
npm install
npm run build-data   # downloads/ -> src/data/calendar.json + games/*.json (commit them)
npm run dev          # local server
npm run build        # dist/
```

- Clubs (display name, logo, names used by the source): `src/data/clubs.json`
- Club logos: `src/web/public/logos/<club-slug>.png|jpg`

## Lint and tests

```bash
npm run lint       # check lint rules, formatting and import order
npm run lint:fix   # apply formatting and safe fixes
npm run test
```

Runs all unit tests with Vitest, including React component tests with Testing
Library and jsdom. Tests use local fixtures and do not call the API.

Biome handles linting and formatting; generated data in `src/data/` is excluded.
GitHub Pages checks lint and tests before building.

## Shared modules

| Module                      | Contents                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/core/config.js`        | `loadConfig()`, `updateConfigKey()`: read/validate/update `config.json`                              |
| `src/core/wait.js`          | `sleep`, `randomDelay`, `waitBeforeNextRequest`, `shortWait()` (100–200 s), `longWait()` (10–15 min) |
| `src/core/format.js`        | `formatDuration`, `timestamp`                                                                        |
| `src/core/validate.js`      | `isEmptyValue`, `isPlainObject`, `fileExists`                                                        |
| `src/core/games.js`         | `isValidGame`                                                                                        |
| `src/core/dated-games.js`   | `readDatedGamesFile`, `writeDatedGamesFile`                                                          |
| `src/core/files.js`         | `writeJson`, `buildFileName`, `saveStats`, `saveScore`                                               |
| `src/core/api-client.js`    | `ApiClient` (API calls, validation, key rotation), `ApiError`, `isNoDataError`                       |
| `src/core/download.js`      | `processGames` (stats + scores download), `downloadGame`, `isAfterToday`                             |
| `src/core/timely-scores.js` | `getScoringActions`, `getTimelyScores`                                                               |
| `src/core/next-games.js`    | `fetchNextGames`, `mergeDatedGames`, `toIsoDate`                                                     |
| `src/core/dates.js`         | Madrid/UTC conversion and date helpers                                                               |
| `src/core/report.js`        | `buildReport`, `writeReport` (sync report)                                                           |
