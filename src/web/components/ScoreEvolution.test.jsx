// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chart } from 'chart.js';
import { StrictMode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import ScoreEvolution from './ScoreEvolution.jsx';
import Tabs from './Tabs.jsx';

vi.mock('chart.js', () => ({
  Chart: Object.assign(
    vi.fn(function () {
      this.destroy = vi.fn();
    }),
    { register: vi.fn() },
  ),
  Legend: {},
  LinearScale: {},
  LineController: {},
  LineElement: {},
  PointElement: {},
  Tooltip: {},
}));

const home = {
  quarterScores: [10, 10, 10, 10],
  timelyScores: [
    { time: 0, score: 0, jersey: null },
    { time: 60000, score: 2, jersey: '5' },
  ],
};
const away = { timelyScores: [] };
const props = { home, away, homeName: 'Local', awayName: 'Visitante' };

beforeEach(() => {
  Chart.mockClear();
});

test('creates a chart with the real config and an accessible canvas, then destroys it on unmount', () => {
  const { unmount } = render(<ScoreEvolution {...props} />);
  const canvas = screen.getByRole('img', { name: 'Evolución del marcador: Local y Visitante' });
  expect(Chart).toHaveBeenCalledTimes(1);
  const [target, config] = Chart.mock.calls[0];
  expect(target).toBe(canvas);
  expect(config.type).toBe('line');
  expect(config.data.datasets[0].label).toBe('Local');
  expect(config.data.datasets[0].data[1]).toEqual({ x: 60000, y: 2, jersey: '5' });
  expect(config.data.datasets[1].label).toBe('Visitante');
  const chart = Chart.mock.instances[0];
  unmount();
  expect(chart.destroy).toHaveBeenCalledTimes(1);
});

test('displays the unavailable message without creating a canvas or chart', () => {
  render(<ScoreEvolution {...props} home={{ timelyScores: [{ time: 0, score: 0, jersey: null }] }} />);
  expect(screen.getByText('Evolución del marcador no disponible.')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(Chart).not.toHaveBeenCalled();
});

test('destroys and recreates the chart when data changes and cleans up when data becomes unavailable', () => {
  const { rerender } = render(<ScoreEvolution {...props} />);
  const first = Chart.mock.instances[0];
  const updatedHome = { ...home, timelyScores: [...home.timelyScores, { time: 90000, score: 4, jersey: '8' }] };
  rerender(<ScoreEvolution {...props} home={updatedHome} />);
  expect(first.destroy).toHaveBeenCalledTimes(1);
  expect(Chart).toHaveBeenCalledTimes(2);
  expect(Chart.mock.calls[1][1].data.datasets[0].data.at(-1)).toEqual({ x: 90000, y: 4, jersey: '8' });
  const second = Chart.mock.instances[1];
  rerender(<ScoreEvolution {...props} home={{}} />);
  expect(second.destroy).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(Chart).toHaveBeenCalledTimes(2);
});

test('entering, leaving and reopening the real tab creates separate instances with cleanup', async () => {
  const user = userEvent.setup();
  const tabs = [
    { id: 'home', label: 'Local', content: <p>Boxscore</p> },
    { id: 'evolution', label: 'Evolución del marcador', content: <ScoreEvolution {...props} /> },
  ];
  const { unmount } = render(<Tabs tabs={tabs} label="Detalle del partido" />);
  expect(Chart).not.toHaveBeenCalled();
  await user.click(screen.getByRole('tab', { name: 'Evolución del marcador' }));
  expect(Chart).toHaveBeenCalledTimes(1);
  const first = Chart.mock.instances[0];
  await user.click(screen.getByRole('tab', { name: 'Local' }));
  expect(first.destroy).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Evolución del marcador' }));
  expect(Chart).toHaveBeenCalledTimes(2);
  unmount();
  expect(Chart.mock.instances[1].destroy).toHaveBeenCalledTimes(1);
  expect(first.destroy).toHaveBeenCalledTimes(1);
});

test('handles StrictMode effect setup and cleanup without leaving a live chart', () => {
  const { unmount } = render(
    <StrictMode>
      <ScoreEvolution {...props} />
    </StrictMode>,
  );
  expect(Chart).toHaveBeenCalledTimes(2);
  expect(Chart.mock.instances[0].destroy).toHaveBeenCalledTimes(1);
  expect(Chart.mock.instances[1].destroy).not.toHaveBeenCalled();
  unmount();
  expect(Chart.mock.instances[1].destroy).toHaveBeenCalledTimes(1);
});
