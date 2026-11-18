function recordResult(standings, team, pointsFor, pointsAgainst, won) {
  let row = standings.get(team);
  if (!row) {
    row = { team, gamesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, points: 0 };
    standings.set(team, row);
  }

  row.gamesPlayed += 1;
  row.pointsFor += pointsFor;
  row.pointsAgainst += pointsAgainst;
  if (won) {
    row.wins += 1;
    row.points += 2;
  } else {
    row.losses += 1;
    row.points += 1;
  }
}

/**
 * Returns the standings rows for one group's rounds, ordered by points with no tiebreaker.
 * Games without both scores do not count.
 */
export function calculateStandings(rounds) {
  const standings = new Map();

  for (const { games } of rounds) {
    for (const { home, away } of games) {
      if (home.score == null || away.score == null) continue;
      if (home.score === away.score) {
        throw new Error(`Tied game between ${home.slug} and ${away.slug} has no winner`);
      }

      const homeWon = home.score > away.score;
      recordResult(standings, home.slug, home.score, away.score, homeWon);
      recordResult(standings, away.slug, away.score, home.score, !homeWon);
    }
  }

  return [...standings.values()].sort((a, b) => b.points - a.points);
}
