import { Chart, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import { useEffect, useMemo, useRef } from 'react';
import { buildScoreEvolution } from '../lib/score-evolution.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, Legend, Tooltip);

export default function ScoreEvolution({ home, away, homeName, awayName }) {
  const canvasRef = useRef(null);
  const config = useMemo(() => buildScoreEvolution(home, away, homeName, awayName), [home, away, homeName, awayName]);

  useEffect(() => {
    if (!config) return;
    const chart = new Chart(canvasRef.current, config);
    return () => chart.destroy();
  }, [config]);

  if (!config) return <p className="tabs__placeholder">Evolución del marcador no disponible.</p>;

  return (
    <div className="score-evolution">
      <canvas ref={canvasRef} role="img" aria-label={`Evolución del marcador: ${homeName} y ${awayName}`} />
    </div>
  );
}
