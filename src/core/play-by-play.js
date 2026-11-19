'use strict';

/**
 * Builds the play-by-play list of a game from its raw actions.
 * The source types and their mapping are documented in docs/play-by-play.md.
 */

const { getActionScore, isHomeAction, readActions } = require('./actions');

const ACTION_TYPES = new Map([
  ['CANASTA-1P', 'free-throw-made'],
  ['CANASTA-2P', 'two-point-made'],
  ['CANASTA-3P', 'three-point-made'],
  ['TIRO1-FALLADO', 'free-throw-missed'],
  ['TIRO2-FALLADO', 'two-point-missed'],
  ['TIRO3-FALLADO', 'three-point-missed'],
  ['1-TIRO-LIBRE', 'one-free-throw-awarded'],
  ['2-TIROS-LIBRES', 'two-free-throws-awarded'],
  ['3-TIROS-LIBRES', 'three-free-throws-awarded'],
  ['REBOTE-DEFENSIVO', 'defensive-rebound'],
  ['REBOTE-OFENSIVO', 'offensive-rebound'],
  ['ASISTENCIA', 'assist'],
  ['PERDIDA', 'turnover'],
  ['RECUPERACION', 'steal'],
  ['TAPON-COMETIDO', 'block-made'],
  ['TAPON-RECIBIDO', 'block-received'],
  ['FALTA-COMETIDA', 'foul-committed'],
  ['FALTA-RECIBIDA', 'foul-received'],
  ['TECNICA', 'technical-foul'],
  ['TANTIDEPORTIVA', 'unsportsmanlike-foul'],
  ['TDESCALIFICANTE', 'disqualifying-foul'],
  ['TBANQUILLO-B', 'bench-technical-foul'],
  ['TBANQUILLO-C', 'coach-technical-foul'],
  ['CAMBIO-JUGADOR-ENTRA', 'substitution-in'],
  ['CAMBIO-JUGADOR-SALE', 'substitution-out'],
  ['TIEMPO-MUERTO-SOLICITADO', 'timeout'],
  ['INICIO-PARTIDO', 'game-start'],
  ['FINAL-PARTIDO', 'game-end'],
  ['INICIO-PERIODO', 'period-start'],
  ['FINAL-PERIODO', 'period-end'],
  ['FLECHA-ALTERNANCIA-LOCAL', 'possession-arrow'],
  ['FLECHA-ALTERNANCIA-VISITANTE', 'possession-arrow'],
]);
const SCORING_ACTION_TYPES = new Set(['CANASTA-1P', 'CANASTA-2P', 'CANASTA-3P']);
const NO_TEAM_ID = -1;

/**
 * Returns the actions of the game as play-by-play entries, in source order
 * (most recent first).
 * @param {unknown} data Raw game data (`envivo.historialacciones` and `partido`).
 * @returns {object[]}
 */
function getPlayByPlay(data) {
  const { actions, homeId, awayId } = readActions(data);

  return actions.map((action) => {
    const type = ACTION_TYPES.get(action.accion_tipo);
    if (!type) {
      throw new Error(`accion_tipo desconocido: ${action.accion_tipo}`);
    }

    let team = null;
    if (Number(action.equipo_id) !== NO_TEAM_ID) {
      team = isHomeAction(action, homeId, awayId) ? 'home' : 'away';
    }

    const entry = {
      id: Number(action.autoincremental_id),
      quarter: Number(action.numero_periodo),
      clock: action.tiempo_partido,
      type,
      team,
      jersey: action.dorsal,
    };
    if (SCORING_ACTION_TYPES.has(action.accion_tipo)) {
      const { home_score, away_score } = getActionScore(action);
      entry.homeScore = home_score;
      entry.awayScore = away_score;
    }
    return entry;
  });
}

module.exports = { getPlayByPlay };
