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
| `key`       | yes      | Key sent as `key` (initial key for `download.js`)                  |
| `outputDir` | no       | Root download directory, relative to the project root (default `.`) |

Each script writes into its own subfolder of `outputDir`:

| Script               | Output                                        |
|----------------------|-----------------------------------------------|
| `download.js`        | `<outputDir>/games/`                          |
| `download-stats.js`  | `<outputDir>/games-stats/`                    |
| `download-scores.js` | `<outputDir>/games-scores/`                   |
| `download-games.js`  | `<outputDir>/games.json`, `games-stats/`, `games-scores/` |

## Usage

```bash
node download.js <startPage> <totalPages>
node download-stats.js
node download-scores.js
node download-games.js
```

