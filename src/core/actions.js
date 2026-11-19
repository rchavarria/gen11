'use strict';

/**
 * Helpers shared by the modules that read the raw actions of a game
 * (`envivo.historialacciones`).
 */

/**
 * Validates the game data and returns its actions and team ids.
 * @param {unknown} data
 * @returns {{actions: object[], homeId: number, awayId: number}}
 */
function readActions(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('El JSON debe contener un objeto en la raíz.');
  }

  const actions = data.envivo?.historialacciones;
  if (!Array.isArray(actions)) {
    throw new Error('No se encontró el array envivo.historialacciones.');
  }

  const game = data.partido;
  if (!game || typeof game !== 'object') {
    throw new Error('No se encontró el objeto partido.');
  }
  if (game.idlocal == null || game.idvisitante == null) {
    throw new Error(`partido.idlocal / partido.idvisitante no válidos: ${game.idlocal} / ${game.idvisitante}`);
  }

  return { actions, homeId: Number(game.idlocal), awayId: Number(game.idvisitante) };
}

/**
 * Returns whether the action belongs to the home team. Throws if it matches neither team.
 * @param {{equipo_id: unknown}} action
 * @param {number} homeId
 * @param {number} awayId
 * @returns {boolean}
 */
function isHomeAction(action, homeId, awayId) {
  const teamId = Number(action.equipo_id);
  if (teamId !== homeId && teamId !== awayId) {
    throw new Error(`equipo_id no coincide con ningún equipo: ${action.equipo_id}`);
  }
  return teamId === homeId;
}

/**
 * Returns the score after the action, decoded from `informacion_adicional`.
 * @param {{informacion_adicional: unknown}} action
 * @returns {{home_score: number, away_score: number}}
 */
function getActionScore(action) {
  let info;
  try {
    info = JSON.parse(action.informacion_adicional);
  } catch {
    throw new Error(`informacion_adicional no válida: ${action.informacion_adicional}`);
  }
  if (!info || typeof info !== 'object' || info.tanteoLocal === undefined || info.tanteoVisitante === undefined) {
    throw new Error(`informacion_adicional sin tanteo: ${action.informacion_adicional}`);
  }
  return { home_score: info.tanteoLocal, away_score: info.tanteoVisitante };
}

module.exports = { readActions, isHomeAction, getActionScore };
