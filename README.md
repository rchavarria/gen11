# 2011 generation

Follow basketball games for the 2011 generation: schedules, results and player
statistics. The [web design guide](docs/web-design.md) covers navigation and privacy.

## Run the site

The site uses the data committed in `src/data/`; no API credentials are needed
to run it locally.

```bash
npm install
npm run dev
```

`npm run build` creates the static site in `dist/`. On pushes to `main`,
GitHub Pages runs lint and tests before building. Run `npm run lint` (or
`npm run lint:fix`) and `npm run test` locally; tests use fixtures, not the API.

## Refresh game data

See the [sync flow diagram](docs/sync-flow.md) for the automated steps and manual handoff.

Copy `config.example.json` to `config.json` at the project root (git-ignored).
Set `baseUrl`, `deviceId` and `key`; the API client saves rotated keys.
Optional `outputDir` controls where downloads and reports go (default: project root).

1. Run `npm run sync` to fetch upcoming games, update schedules, download scores
   and stats, and rebuild the web data. If the upcoming-games request returns an API
   error, sync renews the key and retries once.
2. Read `<outputDir>/sync-reports/<YYYY-MM-DD>.md`. New games go into `pending-games`
   for their category in `CURRENT_SEASON` (`src/core/competitions.js`). Games with
   no matching competition or an invalid date are reported and skipped.
3. Move pending games into their rounds in `src/data/<competition>.json`. Resolve
   unknown teams and correct venues there, not in the generated calendar. Run
   `npm run build-data` to rebuild without fetching, then commit the updated `src/data/`.

To run individual API steps:

```bash
node src/previous-games.js <startPage> <totalPages>
node src/next-games.js
node src/download-games.js
node src/renew-key.js
```

## Data sources and outputs

| Under `src/data/` | Purpose |
| --- | --- |
| `competitions.json` | Season, source category, phases and optional groups with their team slugs. Maintained by hand. |
| `<competition>.json` | Games by phase, optional group and round, plus `pending-games`. The source `IdPartido` is the game `id`. |
| `teams.json` | Unique `slug` and `name`, plus `initials`, `club` and `logo` (filename in `src/web/public/logos/`). Source team names match `name` after trimming and uppercasing; `club` is not a lookup key. |
| `venues.json` | Venue `slug`, `name`, `address` and optional `maps` link. `CampoJuego` must match `name` exactly; an unmatched venue does not overwrite an existing one. |
| `calendar.json` | Generated from placed games and `games-scores/<id>.json` under `outputDir`. Without a score file the game is unplayed. `home.club` and `away.club` contain team slugs. |
| `games/<slug>.json` | Generated when both scores are numeric. Includes period scores, score history (`timelyScores`) and, when `games-stats/<id>.json` exists, player stats by jersey. |

Game URLs use `<competition>-<phase>[-<group>]-<round>-<home>-<away>`. When
renaming a team slug, update its references in competitions and game trees,
regenerate the web data and remove only the replaced detail files.

Schedules use Madrid local time at the source and UTC ISO 8601 in the tree.
`T00:00:00Z` marks an unknown time on the given day (indistinguishable from
actual midnight UTC). On clock changes, ambiguous times use the earlier
occurrence; nonexistent times are rejected. Downloads start only when more
than three hours have passed since the stored timestamp, including the marker.
