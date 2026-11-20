export const BASKET_LABELS = {
  'free-throw-made': 'Tiro libre',
  'two-point-made': 'Canasta de 2',
  'three-point-made': 'Triple',
};

/** Keeps made baskets only, in the original order (most recent first). */
export function getMadeBaskets(playByPlay) {
  if (!Array.isArray(playByPlay)) return [];
  return playByPlay.filter((action) => Object.hasOwn(BASKET_LABELS, action.type));
}

/** "00:01:12.0" -> "1:12" (remaining time in the period) */
export function formatClock(clock) {
  const match = /^(\d+):(\d+):(\d+)/.exec(clock ?? '');
  if (!match) return '';
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return `${minutes}:${match[3]}`;
}
