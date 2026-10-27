'use strict';

/**
 * Client for the data source REST API.
 *
 * Groups every API call and the logic shared by all of them:
 *   - URL building (config.baseUrl + endpoint path).
 *   - x-www-form-urlencoded body building. `id_dispositivo` and `key` are
 *     appended raw at the end, because the data source rejects their
 *     percent-encoded "=" characters ("%3D").
 *   - Request headers and timeout.
 *   - Network, HTTP and JSON error handling.
 *   - Common response validation (`error` and `resultado` fields).
 *   - Key rotation: whenever a response contains a non-empty `key` different
 *     from the current one, it is persisted in config.json and updated in
 *     memory before the data is returned.
 *
 * The client does NOT serialize calls nor wait between them: callers must
 * send requests one by one and decide which pause to use (see wait.js).
 *
 * Usage:
 *   const { loadConfig } = require('./config');
 *   const { ApiClient, isNoDataError } = require('./api-client');
 *
 *   const client = new ApiClient(loadConfig());
 *   const data = await client.getNextGames({ days: 21 });
 */

const { updateConfigKey } = require('./config');
const { formatDuration } = require('./format');
const { isEmptyValue, isPlainObject } = require('./validate');

const DEFAULT_TIMEOUT_MS = 30 * 1000;
const NO_DATA_ERROR = 'sin datos';

const PATHS = Object.freeze({
  device: '/dispositivo.ashx',
  search: '/v2/busqueda.ashx',
  myGames: '/v2/mispartidos.ashx',
  liveGame: '/v2/envivo/partido.ashx',
  liveStats: '/v2/envivo/estadisticas.ashx',
});

const REGISTER_PARAMS = Object.freeze({
  plataforma: 'android',
  tipo_dispositivo: 'mobile',
  version: '5.0.35',
});

/**
 * Error returned by the API itself (non-empty `error`, unexpected
 * `resultado` or invalid response structure).
 * `apiError` holds the raw `error` field of the response, when present.
 */
class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{apiError?: unknown, data?: unknown}} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ApiError';
    if (details.apiError !== undefined) this.apiError = details.apiError;
    if (details.data !== undefined) this.data = details.data;
  }
}

/**
 * Returns true when the error is the API "sin datos" (no data) error,
 * usually meaning the game has not been played yet.
 * @param {unknown} err
 * @returns {boolean}
 */
function isNoDataError(err) {
  return (
    err !== null &&
    typeof err === 'object' &&
    typeof err.apiError === 'string' &&
    err.apiError.trim().toLowerCase() === NO_DATA_ERROR
  );
}

class ApiClient {
  /** @type {ReturnType<typeof import('./config').loadConfig>} */
  #config;

  /** @type {number} */
  #timeoutMs;

  /**
   * @param {ReturnType<typeof import('./config').loadConfig>} config
   * @param {{timeoutMs?: number}} [options]
   */
  constructor(config, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (!isPlainObject(config)) {
      throw new TypeError('ApiClient: config must be an object (see loadConfig()).');
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new TypeError('ApiClient: timeoutMs must be a positive integer.');
    }
    this.#config = config;
    this.#timeoutMs = timeoutMs;
  }

  /** Current configuration (with the latest key). */
  get config() {
    return this.#config;
  }

  /** Current key. */
  get key() {
    return this.#config.key;
  }

  // ---------------------------------------------------------------------------
  // API calls
  // ---------------------------------------------------------------------------

  /**
   * Registers again the device (uid = config.deviceId) to obtain a new key.
   * The new key is always persisted in config.json. `deviceId` is never
   * changed: if the received `id_dispositivo` differs from config.deviceId,
   * an ApiError is thrown and the key is NOT saved.
   * @returns {Promise<object>}
   */
  async renewKey() {
    const deviceId = this.#config.deviceId;
    const data = await this.#post(
      PATHS.device,
      { accion: 'registrar', uid: deviceId, ...REGISTER_PARAMS },
      { auth: false },
    );

    if (typeof data.key !== 'string' || data.key.trim() === '') {
      throw new ApiError('Invalid response: "key" field is missing or empty.', { data });
    }
    if (data.id_dispositivo !== deviceId) {
      throw new ApiError(
        `Invalid response: received id_dispositivo ${JSON.stringify(data.id_dispositivo)} ` +
          `does not match config deviceId ${JSON.stringify(deviceId)}. Key NOT saved.`,
        { data },
      );
    }

    return this.#finish(data);
  }

  /**
   * Searches games by text (club name). Results are paginated 50 by 50.
   * @param {{text: string, skip?: number}} params
   * @returns {Promise<object>} Response with a `partidos` array.
   */
  async searchGames({ text, skip = 0 } = {}) {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new TypeError('searchGames: text must be a non-empty string.');
    }
    if (!Number.isInteger(skip) || skip < 0) {
      throw new TypeError('searchGames: skip must be an integer >= 0.');
    }

    const data = await this.#post(PATHS.search, { accion: 'buscarPartido', texto: text, skip: String(skip) });
    if (!Array.isArray(data.partidos)) {
      throw new ApiError('Invalid response: "partidos" field is missing or is not an array.', { data });
    }
    return this.#finish(data);
  }

  /**
   * Lists the upcoming games of the followed teams.
   * @param {{days?: number}} [params]
   * @returns {Promise<object>} Response with a `mispartidos` array.
   */
  async getNextGames({ days = 21 } = {}) {
    if (!Number.isInteger(days) || days < 1) {
      throw new TypeError('getNextGames: days must be an integer >= 1.');
    }

    const data = await this.#post(PATHS.myGames, { accion: 'listadoProximos', dias: String(days) });
    if (!Array.isArray(data.mispartidos)) {
      throw new ApiError('Invalid response: "mispartidos" field is missing or is not an array.', { data });
    }
    return this.#finish(data);
  }

  /**
   * Live score of a game: score, partials per period and play-by-play.
   * @param {string} gameId Encrypted game id (`IdPartido`).
   * @returns {Promise<object>} Response with `partido` (and `envivo`).
   */
  async getGameScore(gameId) {
    ApiClient.#assertGameId(gameId, 'getGameScore');

    const data = await this.#post(PATHS.liveGame, { id_partido: gameId });
    if (!isPlainObject(data.partido)) {
      throw new ApiError('Invalid response: "partido" field is missing or is not an object.', { data });
    }
    return this.#finish(data);
  }

  /**
   * Live statistics ("acta") of a game: players and their stats.
   * @param {string} gameId Encrypted game id (`IdPartido`).
   * @returns {Promise<object>} Response with `partido` and `estadisticas`.
   */
  async getGameStats(gameId) {
    ApiClient.#assertGameId(gameId, 'getGameStats');

    const data = await this.#post(PATHS.liveStats, { id_partido: gameId });
    if (!isPlainObject(data.partido)) {
      throw new ApiError('Invalid response: "partido" field is missing or is not an object.', { data });
    }
    if (!isPlainObject(data.estadisticas)) {
      throw new ApiError('Invalid response: "estadisticas" field is missing or is not an object.', { data });
    }
    return this.#finish(data);
  }

  // ---------------------------------------------------------------------------
  // Shared logic
  // ---------------------------------------------------------------------------

  static #assertGameId(gameId, method) {
    if (typeof gameId !== 'string' || gameId.trim() === '') {
      throw new TypeError(`${method}: gameId must be a non-empty string.`);
    }
  }

  /**
   * @param {string} apiPath
   * @returns {string}
   */
  #buildUrl(apiPath) {
    const base = this.#config.baseUrl.replace(/\/+$/, '');
    const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    return `${base}${normalizedPath}`;
  }

  /**
   * Builds the x-www-form-urlencoded body. When `auth` is true,
   * `id_dispositivo` and `key` are appended raw (not percent-encoded).
   * @param {Record<string, string>} params
   * @param {{auth?: boolean}} [options]
   * @returns {string}
   */
  #buildBody(params, { auth = true } = {}) {
    const encoded = new URLSearchParams(params).toString();
    if (!auth) return encoded;
    const authParams = `id_dispositivo=${this.#config.deviceId}&key=${this.#config.key}`;
    return encoded ? `${encoded}&${authParams}` : authParams;
  }

  /**
   * Sends a POST request and returns the parsed JSON, after the common
   * validation. Throws on network, HTTP, JSON or API errors.
   * @param {string} apiPath
   * @param {Record<string, string>} params
   * @param {{auth?: boolean}} [options]
   * @returns {Promise<Record<string, any>>}
   */
  async #post(apiPath, params, { auth = true } = {}) {
    const url = this.#buildUrl(apiPath);
    const started = Date.now();
    let response;
    let rawBody;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: this.#buildBody(params, { auth }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
      rawBody = await response.text();
    } catch (err) {
      const reason = err && err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
      if (response) {
        throw new Error(`Network error while reading response body: ${reason}`);
      }
      throw new Error(`Network error while requesting ${url}: ${reason}`);
    } finally {
      ApiClient.#logRequest({
        url,
        status: response ? response.status : null,
        elapsedMs: Date.now() - started,
        size: typeof rawBody === 'string' ? rawBody.length : null,
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} ${response.statusText}. Body: ${rawBody.slice(0, 500)}`);
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (err) {
      throw new Error(`Invalid JSON response: ${err.message}. Body: ${rawBody.slice(0, 500)}`);
    }

    ApiClient.#validateCommon(data);
    return data;
  }

  /**
   * Logs the instrumentation data of a request: url, HTTP status, duration
   * and approximate response size (string length, not exact bytes).
   * @param {{url: string, status: number|null, elapsedMs: number, size: number|null}} info
   */
  static #logRequest({ url, status, elapsedMs, size }) {
    const statusText = status === null ? 'no response' : String(status);
    const sizeText = size === null ? 'size unknown' : `~${ApiClient.#formatSize(size)}`;
    console.log(`[api] POST ${url} | HTTP ${statusText} | ${formatDuration(elapsedMs)} | ${sizeText}`);
  }

  /**
   * Formats an approximate size as B, KB or MB.
   * @param {number} size
   * @returns {string}
   */
  static #formatSize(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Validates the fields shared by every response.
   * @param {unknown} data
   */
  static #validateCommon(data) {
    if (!isPlainObject(data)) {
      throw new ApiError('Invalid response: expected a JSON object.');
    }

    if ('error' in data && !isEmptyValue(data.error)) {
      throw new ApiError(`API returned an error: ${JSON.stringify(data.error)}`, { apiError: data.error, data });
    }

    if ('resultado' in data && data.resultado !== 'correcto') {
      throw new ApiError(`API returned an unexpected resultado: ${JSON.stringify(data.resultado)}`, { data });
    }
  }

  /**
   * Rotates the key (if needed) and returns the data.
   * Must be called after every validation succeeded.
   * @param {Record<string, any>} data
   * @returns {Record<string, any>}
   */
  #finish(data) {
    this.#rotateKey(data);
    return data;
  }

  /**
   * When the response contains a non-empty key different from the current
   * one, persists it in config.json and updates it in memory. Responses
   * without a key are valid (some endpoints do not rotate it).
   * @param {Record<string, any>} data
   */
  #rotateKey(data) {
    if (typeof data.key !== 'string') return;
    const newKey = data.key.trim();
    if (newKey === '' || newKey === this.#config.key) return;
    this.#config = updateConfigKey(this.#config, newKey);
  }
}

module.exports = { ApiClient, ApiError, isNoDataError };

