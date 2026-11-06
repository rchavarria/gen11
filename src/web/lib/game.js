const HIGHLIGHTED_CLUB = 'alcobendas';

export function isHighlighted(game) {
  return game.home.club === HIGHLIGHTED_CLUB || game.away.club === HIGHLIGHTED_CLUB;
}

export function formatTime(time) {
  const hhmm = time?.slice(0, 5);
  return hhmm && hhmm !== '00:00' ? hhmm : null;
}

/** "Cadete Masculino …" -> "CAD", "Junior Masculino …" -> "JUN" */
export function shortCategory(category) {
  if (!category) return null;
  if (/^cadete/i.test(category)) return 'CAD';
  if (/^junior/i.test(category)) return 'JUN';
  return category.slice(0, 3).toUpperCase();
}

export function periodLabel(index) {
  if (index < 4) return `Q${index + 1}`;
  return index === 4 ? 'OT' : `OT${index - 3}`;
}
