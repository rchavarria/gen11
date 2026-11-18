function recordResult(standings, team, pointsFor, pointsAgainst, won, points) {
  let row = standings.get(team);
  if (!row) {
    row = { team, gamesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, points: 0 };
    standings.set(team, row);
  }

  row.gamesPlayed += 1;
  row.pointsFor += pointsFor;
  row.pointsAgainst += pointsAgainst;
  row.points += points;
  if (won) {
    row.wins += 1;
  } else {
    row.losses += 1;
  }
}

/**
 * Returns the standings rows for one group's rounds, ordered by points with no tiebreaker.
 * Uses config.winPoints and config.lossPoints for games with both scores.
 */
export function calculateStandings(config, rounds) {
  const { winPoints, lossPoints } = config;
  const standings = new Map();

  for (const { games } of rounds) {
    for (const { home, away } of games) {
      if (home.score == null || away.score == null) continue;
      if (home.score === away.score) {
        throw new Error(`Tied game between ${home.slug} and ${away.slug} has no winner`);
      }

      const homeWon = home.score > away.score;
      recordResult(standings, home.slug, home.score, away.score, homeWon, homeWon ? winPoints : lossPoints);
      recordResult(standings, away.slug, away.score, home.score, !homeWon, homeWon ? lossPoints : winPoints);
    }
  }

  return [...standings.values()].sort((a, b) => b.points - a.points);
}
