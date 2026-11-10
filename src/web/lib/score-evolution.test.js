import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildScoreEvolution } from './score-evolution.js';

const origin = { time: 0, score: 0, jersey: null };
const home = {
  quarterScores: [20, 20, 20, 20],
  timelyScores: [
    origin,
    { time: 33000, score: 2, jersey: '05' },
    { time: 60000, score: 3, jersey: '05' },
    { time: 60000, score: 4, jersey: '05' },
  ],
};
const away = {
  quarterScores: [20, 20, 20, 20],
  timelyScores: [origin, { time: 90000, score: 3, jersey: '7' }],
};
const build = (local = home, visitor = away) => buildScoreEvolution(local, visitor, 'Local', 'Visitante');

test('maps both teams without mutating input, preserving the initial point and tied baskets', () => {
  const original = JSON.stringify({ home, away });
  const config = build();
  assert.equal(config.type, 'line');
  assert.deepEqual(config.data.datasets, [
    {
      label: 'Local',
      data: [
        { x: 0, y: 0, jersey: null },
        { x: 33000, y: 2, jersey: '05' },
        { x: 60000, y: 3, jersey: '05' },
        { x: 60000, y: 4, jersey: '05' },
      ],
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
      fill: false,
      tension: 0.4,
    },
    {
      label: 'Visitante',
      data: [
        { x: 0, y: 0, jersey: null },
        { x: 90000, y: 3, jersey: '7' },
      ],
      borderColor: 'rgb(54, 162, 235)',
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      fill: false,
      tension: 0.4,
    },
  ]);
  assert.equal(JSON.stringify({ home, away }), original);
});

test('axes display minutes and integer points with a 40 minute minimum', () => {
  const { options } = build();
  assert.equal(options.responsive, true);
  assert.equal(options.maintainAspectRatio, false);
  assert.equal(options.scales.x.min, 0);
  assert.equal(options.scales.x.max, 40 * 60000);
  assert.equal(options.scales.x.ticks.callback(0), 0);
  assert.equal(options.scales.x.ticks.callback(600000), 10);
  assert.equal(options.scales.y.beginAtZero, true);
  assert.equal(options.scales.y.ticks.precision, 0);
});

test('extends the time axis to overtime ends using either team periods or latest action', () => {
  for (const [local, visitor, expectedMinutes] of [
    [{ ...home, quarterScores: [20, 20, 20, 20, 5] }, away, 45],
    [home, { ...away, quarterScores: [20, 20, 20, 20, 5, 5] }, 50],
    [{ ...home, timelyScores: [...home.timelyScores, { time: 46 * 60000, score: 6, jersey: '05' }] }, away, 50],
    [home, { ...away, timelyScores: [...away.timelyScores, { time: 45 * 60000, score: 5, jersey: '7' }] }, 45],
  ]) {
    assert.equal(build(local, visitor).options.scales.x.max, expectedMinutes * 60000);
  }
});

test('tooltips display elapsed mm:ss, club, accumulated score and jersey except at the origin', () => {
  const config = build();
  const { title, label } = config.options.plugins.tooltip.callbacks;
  assert.equal(title([{ parsed: { x: 33900 } }]), '00:33');
  assert.equal(title([{ parsed: { x: 2729500 } }]), '45:29');
  assert.equal(title([]), '');
  const dataset = config.data.datasets[0];
  assert.equal(label({ dataset, raw: dataset.data[1] }), 'Local: 2 puntos · Dorsal 05');
  assert.equal(label({ dataset, raw: dataset.data[0] }), 'Local: 0 puntos');
});

test('returns no chart when both teams lack baskets, including missing arrays and initial points only', () => {
  for (const emptyHome of [{}, { timelyScores: [] }, { timelyScores: [origin] }]) {
    for (const emptyAway of [{}, { timelyScores: [] }, { timelyScores: [origin] }]) {
      assert.equal(build(emptyHome, emptyAway), null);
    }
  }
});

test('keeps the available team when only one side has baskets', () => {
  assert.deepEqual(build(home, {}).data.datasets[1].data, []);
  assert.deepEqual(build({}, away).data.datasets[0].data, []);
  assert.equal(build({}, away).data.datasets[1].data[1].y, 3);
  assert.deepEqual(build(home, { timelyScores: [origin] }).data.datasets[1].data, [{ x: 0, y: 0, jersey: null }]);
});
