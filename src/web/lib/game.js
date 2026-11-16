import teams from '../../data/teams.json';

const highlightedTeams = new Set(
  teams.filter((team) => team.club === 'BALONCESTO ALCOBENDAS').map((team) => team.slug),
);

export function isHighlighted(game) {
  return highlightedTeams.has(game.home.club) || highlightedTeams.has(game.away.club);
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
