import assert from 'node:assert/strict';
import { test } from 'vitest';
import { calculateStandings } from './standings.js';

const config = {
  type: 'computed',
  winPoints: 2,
  lossPoints: 1,
  walkoverPoints: 0,
};

function game(home, away, homeScore, awayScore) {
  return {
    home: { slug: home, score: homeScore },
    away: { slug: away, score: awayScore },
  };
}

function rounds(...roundGames) {
  return roundGames.map((games, index) => ({ id: `j0${index + 1}`, games }));
}

test('ranks the team that wins both the home and away games first', () => {
  const schedule = rounds([game('a', 'b', 70, 60)], [game('b', 'a', 60, 65)]);

  assert.deepEqual(calculateStandings(config, schedule), [
    { team: 'a', gamesPlayed: 2, wins: 2, losses: 0, pointsFor: 135, pointsAgainst: 120, points: 4 },
    { team: 'b', gamesPlayed: 2, wins: 0, losses: 2, pointsFor: 120, pointsAgainst: 135, points: 2 },
  ]);
});

test('awards three points per win and zero per loss when configured', () => {
  const scoringConfig = { ...config, winPoints: 3, lossPoints: 0 };
  const schedule = rounds([game('a', 'b', 70, 60)], [game('b', 'a', 60, 65)]);

  assert.deepEqual(calculateStandings(scoringConfig, schedule), [
    { team: 'a', gamesPlayed: 2, wins: 2, losses: 0, pointsFor: 135, pointsAgainst: 120, points: 6 },
    { team: 'b', gamesPlayed: 2, wins: 0, losses: 2, pointsFor: 120, pointsAgainst: 135, points: 0 },
  ]);
});

test('does not count the pending return game in any total', () => {
  const schedule = rounds([game('a', 'b', 70, 60)], [game('b', 'a', null, null)]);

  assert.deepEqual(calculateStandings(config, schedule), [
    { team: 'a', gamesPlayed: 1, wins: 1, losses: 0, pointsFor: 70, pointsAgainst: 60, points: 2 },
    { team: 'b', gamesPlayed: 1, wins: 0, losses: 1, pointsFor: 60, pointsAgainst: 70, points: 1 },
  ]);
});

test('ranks three teams after a complete home-and-away schedule', () => {
  const schedule = rounds(
    [game('b', 'c', 70, 60)],
    [game('a', 'b', 70, 60)],
    [game('a', 'c', 70, 60)],
    [game('c', 'b', 60, 70)],
    [game('b', 'a', 60, 70)],
    [game('c', 'a', 70, 60)],
  );

  assert.deepEqual(calculateStandings(config, schedule), [
    { team: 'a', gamesPlayed: 4, wins: 3, losses: 1, pointsFor: 270, pointsAgainst: 250, points: 7 },
    { team: 'b', gamesPlayed: 4, wins: 2, losses: 2, pointsFor: 260, pointsAgainst: 260, points: 6 },
    { team: 'c', gamesPlayed: 4, wins: 1, losses: 3, pointsFor: 250, pointsAgainst: 270, points: 5 },
  ]);
});

test('ranks by points rather than wins when teams have played different numbers of games', () => {
  const schedule = rounds(
    [game('a', 'b', 70, 60), game('c', 'd', 70, 60)],
    [game('c', 'a', 70, 60), game('b', 'd', 70, 60)],
    [game('a', 'd', 60, 70), game('b', 'c', 70, 60)],
    [game('b', 'a', null, null), game('d', 'c', 60, 70)],
    [game('a', 'c', 60, 70), game('d', 'b', null, null)],
    [game('d', 'a', 70, 60), game('c', 'b', null, null)],
  );

  assert.deepEqual(calculateStandings(config, schedule), [
    { team: 'c', gamesPlayed: 5, wins: 4, losses: 1, pointsFor: 340, pointsAgainst: 310, points: 9 },
    { team: 'd', gamesPlayed: 5, wins: 2, losses: 3, pointsFor: 320, pointsAgainst: 330, points: 7 },
    { team: 'a', gamesPlayed: 5, wins: 1, losses: 4, pointsFor: 310, pointsAgainst: 340, points: 6 },
    { team: 'b', gamesPlayed: 3, wins: 2, losses: 1, pointsFor: 200, pointsAgainst: 190, points: 5 },
  ]);
});
