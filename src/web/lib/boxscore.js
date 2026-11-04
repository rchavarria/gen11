/** 1019177 -> "16:59" */
export function formatPlayed(ms) {
  const totalSeconds = Math.round((ms || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function playerPoints(player) {
  return player.freeThrows.made + 2 * player.twoPointers.made + 3 * player.threePointers.made;
}

/** 5 -> "+5", -3 -> "-3", 0 -> "0" */
export function formatPlusMinus(value) {
  return value > 0 ? `+${value}` : String(value);
}

/** Numeric jerseys ascending; non-numeric ones (e.g. "X") last, in source order. */
export function sortByJersey(players) {
  const numeric = (player) => (/^\d+$/.test(player.jersey) ? Number(player.jersey) : Infinity);
  return players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => numeric(a.player) - numeric(b.player) || a.index - b.index)
    .map(({ player }) => player);
}

export function boxscoreTotals(players) {
  return {
    points: players.reduce((sum, player) => sum + playerPoints(player), 0),
    efficiency: players.reduce((sum, player) => sum + player.efficiency, 0),
  };
}
