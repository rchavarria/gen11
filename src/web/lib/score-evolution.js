const MINUTE_MS = 60 * 1000;
const REGULAR_MS = 40 * MINUTE_MS;
const OVERTIME_MS = 5 * MINUTE_MS;

function formatElapsed(time) {
  const seconds = Math.floor(time / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function buildDataset(side, name, color) {
  return {
    label: name,
    data: (side.timelyScores ?? []).map(({ time, score, jersey }) => ({ x: time, y: score, jersey })),
    borderColor: `rgb(${color})`,
    backgroundColor: `rgba(${color}, 0.5)`,
    fill: false,
    tension: 0.4,
  };
}

export function buildScoreEvolution(home, away, homeName, awayName) {
  const hasScores = (side) => side.timelyScores?.some((point) => point.score > 0);
  if (!hasScores(home) && !hasScores(away)) return null;

  const datasets = [buildDataset(home, homeName, '255, 99, 132'), buildDataset(away, awayName, '54, 162, 235')];
  const periodCount = Math.max(home.quarterScores?.length ?? 0, away.quarterScores?.length ?? 0);
  const periodEnd = REGULAR_MS + Math.max(0, periodCount - 4) * OVERTIME_MS;
  const lastTime = datasets.reduce(
    (max, dataset) => dataset.data.reduce((time, point) => Math.max(time, point.x), max),
    REGULAR_MS,
  );
  const maxTime = Math.max(periodEnd, REGULAR_MS + Math.ceil((lastTime - REGULAR_MS) / OVERTIME_MS) * OVERTIME_MS);

  return {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            title: (items) => (items.length ? formatElapsed(items[0].parsed.x) : ''),
            label: ({ dataset, raw }) =>
              `${dataset.label}: ${raw.y} puntos${raw.jersey == null ? '' : ` · Dorsal ${raw.jersey}`}`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: maxTime,
          title: { display: true, text: 'Tiempo (min)' },
          ticks: {
            stepSize: 5 * MINUTE_MS,
            callback: (value) => value / MINUTE_MS,
          },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Puntos' },
          ticks: { precision: 0 },
        },
      },
    },
  };
}
