# 2011 generation

Gather basket players data born on 2011

## Configuration

Scripts read their configuration from `config.json` at the project root
(ignored by git). Copy the example and fill in your values:

```bash
cp config.example.json config.json
```

| Key         | Required | Description                                                        |
|-------------|----------|--------------------------------------------------------------------|
| `baseUrl`   | yes      | Base URL of the API                                                |
| `deviceId`  | yes      | Registered device id, sent as `id_dispositivo`                     |
| `key`       | yes      | Key sent as `key` (rotating key: `download.js` and `next-games.js` update it after every request) |
| `outputDir` | no       | Root download directory, relative to the project root (default `.`) |

Each script writes into its own subfolder of `outputDir`:

| Script               | Output                                        |
|----------------------|-----------------------------------------------|
| `download.js`        | `<outputDir>/games/`                          |
| `download-stats.js`  | `<outputDir>/games-stats/`                    |
| `download-scores.js` | `<outputDir>/games-scores/`                   |
| `download-games.js`  | `<outputDir>/games.json`, `games-stats/`, `games-scores/` |
| `next-games.js`      | `<outputDir>/next-games/<YYYY-MM-DD>.json`    |

## Usage

```bash
node src/download.js <startPage> <totalPages>
node src/download-stats.js
node src/download-scores.js
node src/download-games.js
node src/next-games.js
node src/scored-points.js <input.json>
```

## Shared modules

| Module            | Contents                                                                 |
|-------------------|--------------------------------------------------------------------------|
| `src/core/config.js`   | `loadConfig()`, `updateConfigKey()`: read/validate/update `config.json`  |
| `src/core/wait.js`     | `sleep`, `randomDelay`, `waitBeforeNextRequest`, `shortWait()` (100–200 s), `longWait()` (10–15 min) |
| `src/core/format.js`   | `formatDuration`, `timestamp`                                            |
| `src/core/validate.js` | `isEmptyValue`, `isPlainObject`, `fileExists`                            |
| `src/core/files.js`    | `writeJson`, `buildFileName`, `saveStats`, `saveScore`                   |

