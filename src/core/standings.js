'use strict';

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

function headToHeadMargin(rounds, first, second) {
  let margin = 0;
  for (const { games } of rounds) {
    for (const { home, away } of games) {
      if (home.score == null || away.score == null) continue;
      if (home.slug === first && away.slug === second) {
        margin += home.score - away.score;
      } else if (away.slug === first && home.slug === second) {
        margin += away.score - home.score;
      }
    }
  }
  return margin;
}

/**
 * Returns one group's standings ordered by points, with an optional two-team head-to-head tiebreaker.
 * Uses config.winPoints and config.lossPoints for games with both scores.
 */
function calculateStandings(config, rounds) {
  const { winPoints, lossPoints, tieBreaker = [] } = config;
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

  const rows = [...standings.values()].sort((a, b) => b.points - a.points);
  if (!tieBreaker.includes('head-to-head')) return rows;

  for (let start = 0; start < rows.length; ) {
    const first = rows[start];
    let end = start + 1;
    while (end < rows.length && rows[end].points === first.points) end += 1;

    if (end - start === 2) {
      const second = rows[start + 1];
      if (headToHeadMargin(rounds, first.team, second.team) < 0) {
        rows[start] = second;
        rows[start + 1] = first;
      }
    }
    start = end;
  }
  return rows;
}

module.exports = { calculateStandings };
