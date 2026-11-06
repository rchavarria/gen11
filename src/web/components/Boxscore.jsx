import { boxscoreTotals, formatPlayed, formatPlusMinus, playerPoints, sortByJersey } from '../lib/boxscore.js';

export default function Boxscore({ players, clubName }) {
  if (!players) return <p className="tabs__placeholder">Estadísticas no disponibles.</p>;

  const totals = boxscoreTotals(players);

  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the table horizontally.
    <section className="game-detail__table-scroll" aria-label={`Boxscore de ${clubName}`} tabIndex={0}>
      <table className="quarter-scores boxscore">
        <caption>Boxscore de {clubName}</caption>
        <thead>
          <tr>
            <th scope="col">Dorsal</th>
            <th scope="col">Min</th>
            <th scope="col">Pts</th>
            <th scope="col">Val</th>
            <th scope="col">+/-</th>
          </tr>
        </thead>
        <tbody>
          {sortByJersey(players).map((player, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Jerseys can repeat and these rows have no local state.
            <tr key={index}>
              <th scope="row">{player.jersey}</th>
              <td>{formatPlayed(player.msPlayed)}</td>
              <td>{playerPoints(player)}</td>
              <td>{player.efficiency}</td>
              <td>{formatPlusMinus(player.plusMinus)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Totales</th>
            <td></td>
            <td>{totals.points}</td>
            <td>{totals.efficiency}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
