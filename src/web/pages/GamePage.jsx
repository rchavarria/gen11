import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clubs from '../../data/clubs.json';
import Boxscore from '../components/Boxscore.jsx';
import ClubLogo from '../components/ClubLogo.jsx';
import Tabs from '../components/Tabs.jsx';
import { formatDay } from '../lib/dates.js';
import { formatTime, periodLabel } from '../lib/game.js';

const gameFiles = import.meta.glob('../../data/games/*.json', { import: 'default' });
const clubsBySlug = new Map(clubs.map((club) => [club.slug, club]));

function GameDetail({ game }) {
  const homeClub = clubsBySlug.get(game.home.slug);
  const awayClub = clubsBySlug.get(game.away.slug);
  if (!homeClub || !awayClub) throw new Error('Club no encontrado.');

  const sides = [
    { ...game.home, club: homeClub, winner: game.home.score > game.away.score },
    { ...game.away, club: awayClub, winner: game.away.score > game.home.score },
  ];
  const periods = Array.from(
    {
      length: Math.max(game.home.quarterScores.length, game.away.quarterScores.length),
    },
    (_, index) => index,
  );
  const time = formatTime(game.time);
  const placeholder = (title) => <p className="tabs__placeholder">{title}: próximamente.</p>;
  const tabs = [
    {
      id: 'home',
      label: homeClub.initials,
      content: <Boxscore players={game.home.players} clubName={homeClub.name} />,
    },
    {
      id: 'away',
      label: awayClub.initials,
      content: <Boxscore players={game.away.players} clubName={awayClub.name} />,
    },
    { id: 'evolution', label: 'Evolución del marcador', content: placeholder('Evolución del marcador') },
    { id: 'play-by-play', label: 'Jugada a jugada', content: placeholder('Jugada a jugada') },
  ];

  return (
    <article className="game-detail">
      <header className="game-detail__header">
        <h1>{game.category}</h1>
      </header>

      <div className="game-detail__scoreboard">
        <div className="game-detail__club">
          <ClubLogo club={sides[0].club} />
          <h2>{sides[0].club.name}</h2>
        </div>

        <div className="game-detail__center">
          {/* biome-ignore lint/a11y/useSemanticElements: This groups scores, not form controls. */}
          <div className="game-detail__score" role="group" aria-label="Marcador total">
            {sides.map((side) => (
              <span
                key={side.slug}
                role="img"
                className={`game-detail__score-cell${side.winner ? ' game-detail__score-cell--winner' : ''}`}
                aria-label={`${side.club.name}: ${side.score}${side.winner ? ' (ganador)' : ''}`}
              >
                {side.score}
              </span>
            ))}
          </div>
          <p className="game-detail__when">
            {formatDay(game.date)}
            {time ? ` · ${time}` : ''}
          </p>
        </div>

        <div className="game-detail__club">
          <ClubLogo club={sides[1].club} />
          <h2>{sides[1].club.name}</h2>
        </div>
      </div>

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the table horizontally. */}
      <section className="game-detail__table-scroll" aria-label="Marcador por cuartos" tabIndex={0}>
        <table className="quarter-scores">
          <caption>Marcador por cuartos</caption>
          <thead>
            <tr>
              <th scope="col">Club</th>
              {periods.map((index) => (
                <th scope="col" key={index}>
                  {periodLabel(index)}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {sides.map((side) => (
              <tr key={side.slug}>
                <th scope="row">
                  <span className="quarter-scores__club">
                    <ClubLogo club={side.club} />
                    {side.club.name}
                  </span>
                </th>
                {periods.map((period) => (
                  <td key={period}>{side.quarterScores[period] ?? '–'}</td>
                ))}
                <td className={side.winner ? 'game-detail__winner' : undefined}>{side.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Tabs label="Detalle del partido" tabs={tabs} />
    </article>
  );
}

export default function GamePage() {
  const { slug } = useParams();
  const [state, setState] = useState({ slug: null, status: 'loading', game: null });
  const game = state.slug === slug ? state.game : null;
  const status = state.slug === slug ? state.status : 'loading';
  const back = game ? `/?mes=${game.date.slice(0, 7)}` : '/';

  useEffect(() => {
    let active = true;
    const loadGame = gameFiles[`../../data/games/${slug}.json`];
    if (!loadGame) {
      setState({ slug, status: 'not-found', game: null });
      return;
    }

    setState({ slug, status: 'loading', game: null });
    loadGame()
      .then((data) => {
        if (active) setState({ slug, status: 'ready', game: data });
      })
      .catch(() => {
        if (active) setState({ slug, status: 'error', game: null });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <main className="page">
      <Link className="back-link" to={back}>
        ‹ Calendario
      </Link>
      {status === 'loading' && <p role="status">Cargando…</p>}
      {status === 'not-found' && <p>Partido no encontrado.</p>}
      {status === 'error' && <p role="alert">No se pudo cargar el partido.</p>}
      {game && <GameDetail game={game} />}
    </main>
  );
}
