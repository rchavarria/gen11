'use strict';

/**
 * Shared validation for games.
 */

/**
 * Returns true when the game has a non-empty hexadecimal id.
 * @param {unknown} game
 * @returns {boolean}
 */
function isValidGame(game) {
  return game !== null && typeof game === 'object' && typeof game.id === 'string' && /^[0-9A-Fa-f]+$/.test(game.id);
}

module.exports = { isValidGame };
