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
| `download-games.js` | `src/data/<competition>.json`, `games-stats/`, `games-scores/`                |
| `next-games.js`     | `<outputDir>/next-games/<YYYY-MM-DD>.json`, `src/data/<competition>.json`     |
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

## Competitions

Games are organised as seasons › competitions › phases › groups › rounds › games:

- `src/data/competitions.json` (by hand): each competition's `id` (e.g. `s67-kdt-oro`),
  `season`, source `category`, and its `phases` (`league`/`knockout`), with optional
  `groups` and their `teams` (club slugs).
- `src/data/<competition>.json` (maintained by `sync`): the game tree
  `phases[].groups[].rounds[].games[]` (or `phases[].rounds[]` for phases without groups),
  plus a `pending-games` array.
- Games are identified by the source `IdPartido` (`id`). New games are added to
  `pending-games` of the current-season competition (`CURRENT_SEASON` in
  `src/core/competitions.js`) for their category; games whose category has no
  competition are discarded and reported. Placing a pending game in its round is
  a manual step: move it in the JSON and run `sync` (or `build-data`) again.
- Each game's `home` and `away` contains the club `slug` and a `score`, initially
  `null` and filled from the downloaded score file. For a new pending game, an
  unknown club retains its source `name` until it can be resolved in `clubs.json`.
  Web scores continue to come directly from the downloaded files.
- The game slug is not stored: it is computed as
  `<competition>-<phase>[-<group>]-<round>-<home>-<away>`, using club slugs from `clubs.json`.

`sync.js` runs the whole pipeline: fetch upcoming games and add the new ones
to the competition trees; if that request fails with an API error,
it renews the key and retries once. It also updates dates and times of known
games, downloads stats/scores, rebuilds `calendar.json` and per-game files,
including each game's score evolution, and writes a report listing discarded
games and games pending placement.

Game `date` fields use UTC ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`), converted from
Europe/Madrid. The UI displays Madrid dates and times. `T00:00:00Z` represents an
unknown time on that calendar day; a real time converting to midnight UTC is
indistinguishable from that marker. Missing or invalid source dates for new games
are reported and skipped. Ambiguous Madrid times during the autumn clock change
use the earlier occurrence; nonexistent times during the spring change are rejected.
Downloads are skipped until more than three hours after the stored UTC `date`.
For unknown times, this rule uses the stored `00:00:00Z` marker.

`build-data.js` reads game metadata from the competition trees (placed games only;
`pending-games` are ignored) and scores from `games-scores/<id>.json`.
Without a score file, games are shown as not played.
For games with both numeric scores, it also rewrites `src/data/games/<slug>.json`.
These files preserve the tree game fields, including `id`, plus the competition `category`, but omit
`downloaded` and `scored`. They replace the tree's `home` and `away` with objects containing the club `slug`, `score`, and numeric
`quarterScores` ordered by period (including overtime). Club slugs are validated
against `clubs.json`; source names can be resolved through `sourceNames`. Unknown clubs cause an error.
If `games-stats/<id>.json` exists, `home` and `away` also get `players`: one entry per player
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
| `src/core/competitions.js`  | Competitions and game trees: read/write, `listGames`, `computeSlug`, `loadClubs`                     |
| `src/core/files.js`         | `writeJson`, `buildFileName`, `saveStats`, `saveScore`                                               |
| `src/core/api-client.js`    | `ApiClient` (API calls, validation, key rotation), `ApiError`, `isNoDataError`                       |
| `src/core/download.js`      | `processGames` (stats + scores download), `downloadGame`, `isAfterGameSchedule`                      |
| `src/core/timely-scores.js` | `getScoringActions`, `getTimelyScores`                                                               |
| `src/core/next-games.js`    | `fetchNextGames`, `mergeNextGames`                                                                   |
| `src/core/dates.js`         | Madrid/UTC conversion and date helpers                                                               |
| `src/core/report.js`        | `buildReport`, `writeReport` (sync report)                                                           |
