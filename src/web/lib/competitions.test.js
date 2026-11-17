import { expect, test } from 'vitest';
import { findRounds, phaseGroupOptions, roundLabel, toCardGame } from './competitions.js';

const competition = {
  id: 's67-kdt-oro',
  category: 'Cadete Masculino',
  phases: [
    {
      id: 'f1',
      name: 'Primera fase',
      groups: [
        { id: 'g1', name: 'Grupo 1' },
        { id: 'g2', name: 'Grupo 2' },
      ],
    },
    { id: 'playoffs', name: 'Playoffs' },
  ],
};

test('creates a selectable option for each phase and group, or the phase alone', () => {
  expect(phaseGroupOptions(competition)).toEqual([
    { id: 'f1:g1', phaseId: 'f1', groupId: 'g1', label: 'Primera fase · Grupo 1' },
    { id: 'f1:g2', phaseId: 'f1', groupId: 'g2', label: 'Primera fase · Grupo 2' },
    { id: 'playoffs:', phaseId: 'playoffs', groupId: null, label: 'Playoffs' },
  ]);
});

test('finds rounds in grouped and ungrouped phases', () => {
  const tree = {
    phases: [
      { id: 'f1', groups: [{ id: 'g1', rounds: [{ id: 'j01' }] }] },
      { id: 'playoffs', rounds: [{ id: 'j1' }] },
    ],
  };
  expect(findRounds(tree, 'f1', 'g1')).toEqual([{ id: 'j01' }]);
  expect(findRounds(tree, 'f1', null)).toEqual([]);
  expect(findRounds(tree, 'playoffs', null)).toEqual([{ id: 'j1' }]);
  expect(findRounds(tree, 'missing', null)).toEqual([]);
});

test.each([
  ['j1', 'J01'],
  ['j05', 'J05'],
  ['j10', 'J10'],
])('abbreviates round %s as %s', (id, label) => {
  expect(roundLabel(id, true)).toBe(label);
});

test.each([
  ['j01', 'Jornada 1'],
  ['jornada-12', 'Jornada 12'],
  ['playoff-final', 'playoff-final'],
])('labels round %s as %s', (id, label) => {
  expect(roundLabel(id)).toBe(label);
});

test('adapts a tree game to a GameCard game with the canonical slug', () => {
  const game = toCardGame(
    {
      date: '2026-09-19T16:00:00Z',
      venue: 'valdebebas',
      home: { slug: 'realmadrid', score: 107 },
      away: { slug: 'sba', score: 51 },
    },
    { competition, phaseId: 'f1', groupId: 'g1', roundId: 'j01' },
  );
  expect(game).toMatchObject({
    slug: 's67-kdt-oro-f1-g1-j01-realmadrid-sba',
    date: new Date('2026-09-19T16:00:00Z'),
    category: 'Cadete Masculino',
    played: true,
    home: { club: 'realmadrid', score: 107 },
    away: { club: 'sba', score: 51 },
  });
});
