import { Link, useParams } from 'react-router-dom';
import calendar from '../../data/calendar.json';
import GameCard from '../components/GameCard.jsx';

export default function GamePage() {
  const { slug } = useParams();
  const game = calendar.find((item) => item.slug === slug);
  const back = game ? `/?mes=${game.date.slice(0, 7)}` : '/';

  return (
    <main className="page">
      <Link className="back-link" to={back}>‹ Calendario</Link>
      {game
        ? <GameCard game={game} link={false} />
        : <p>Partido no encontrado.</p>}
    </main>
  );
}
