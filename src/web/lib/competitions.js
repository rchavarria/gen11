import teams from '../../data/teams.json';

const teamsByName = new Map(teams.map((team) => [team.name.trim().toUpperCase(), team.slug]));

export function phaseGroupOptions(competition) {
  return competition.phases.flatMap((phase) =>
    phase.groups?.length
      ? phase.groups.map((group) => ({
          id: `${phase.id}:${group.id}`,
          phaseId: phase.id,
          groupId: group.id,
          label: `${phase.name} · ${group.name}`,
        }))
      : [{ id: `${phase.id}:`, phaseId: phase.id, groupId: null, label: phase.name }],
  );
}

export function findRounds(tree, phaseId, groupId) {
  const phase = tree.phases.find((item) => item.id === phaseId);
  if (!phase) return [];
  if (groupId) return phase.groups?.find((group) => group.id === groupId)?.rounds ?? [];
  return phase.rounds ?? [];
}

export function sortRounds(rounds) {
  return rounds
    .map((round) => ({
      ...round,
      games: [...round.games].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function roundLabel(id, abbreviated = false) {
  const match = /^j(?:ornada)?[-_]?0*(\d+)$/i.exec(id);
  if (!match) return id;
  const number = Number(match[1]);
  return abbreviated ? `J${String(number).padStart(2, '0')}` : `Jornada ${number}`;
}

function sideSlug(side) {
  if (side.slug) return side.slug;
  const knownSlug = side.name && teamsByName.get(side.name.trim().toUpperCase());
  if (knownSlug) return knownSlug;
  return String(side.name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function toCardGame(game, { competition, phaseId, groupId, roundId }) {
  const homeSlug = sideSlug(game.home);
  const awaySlug = sideSlug(game.away);
  return {
    slug: [competition.id, phaseId, groupId, roundId, homeSlug, awaySlug].filter(Boolean).join('-'),
    date: new Date(game.date),
    venue: game.venue,
    category: competition.category,
    played: game.home.score != null && game.away.score != null,
    home: { club: homeSlug, name: game.home.name, score: game.home.score ?? null },
    away: { club: awaySlug, name: game.away.name, score: game.away.score ?? null },
  };
}
