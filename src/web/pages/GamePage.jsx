import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import teams from '../../data/teams.json';
import venues from '../../data/venues.json';
import Boxscore from '../components/Boxscore.jsx';
import ClubLogo from '../components/ClubLogo.jsx';
import GameVideo from '../components/GameVideo.jsx';
import { CalendarIcon, ClockIcon, MapPinIcon } from '../components/Icons.jsx';
import ScoreEvolution from '../components/ScoreEvolution.jsx';
import Tabs from '../components/Tabs.jsx';
import { formatDay, gameDay, gameTime } from '../lib/dates.js';
import { periodLabel } from '../lib/game.js';

const gameFiles = import.meta.glob('../../data/games/*.json', { import: 'default' });
const teamsBySlug = new Map(teams.map((team) => [team.slug, team]));
const venuesBySlug = new Map(venues.map((venue) => [venue.slug, venue]));

function GameDetail({ game }) {
  const homeClub = teamsBySlug.get(game.home.slug);
  const awayClub = teamsBySlug.get(game.away.slug);
  if (!homeClub || !awayClub) throw new Error('Equipo no encontrado.');
  const venue = venuesBySlug.get(game.venue);
  let maps;
  if (venue?.maps) {
    try {
      const url = new URL(venue.maps);
      if (['http:', 'https:'].includes(url.protocol)) maps = venue.maps;
    } catch {
      // Keep the venue name visible when its URL is invalid.
    }
  }

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
  const time = gameTime(game.date);
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
    {
      id: 'evolution',
      label: 'Evolución del marcador',
      content: <ScoreEvolution home={game.home} away={game.away} homeName={homeClub.name} awayName={awayClub.name} />,
    },
    { id: 'play-by-play', label: 'Jugada a jugada', content: placeholder('Jugada a jugada') },
  ];

  return (
    <article className="game-detail">
      <header className="game-detail__header">
        <h1>{game.category}</h1>
      </header>

      <div className="game-detail__scoreboard">
        <div className="game-detail__club">
          <ClubLogo team={sides[0].club} />
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
        </div>

        <div className="game-detail__club">
          <ClubLogo team={sides[1].club} />
          <h2>{sides[1].club.name}</h2>
        </div>
      </div>

      <p className="game-detail__when">
        <span className="game-detail__meta-item">
          <CalendarIcon />
          <strong className="game-detail__date">{formatDay(gameDay(game.date))}</strong>
        </span>
        {time && (
          <>
            <span className="game-detail__separator" aria-hidden="true">
              •
            </span>
            <span className="game-detail__meta-item">
              <ClockIcon />
              <span className="game-detail__time">{time}</span>
            </span>
          </>
        )}
      </p>
      {venue && (
        <p className="game-detail__venue">
          <MapPinIcon />
          {maps ? (
            <a href={maps} target="_blank" rel="noopener noreferrer">
              {venue.name}
            </a>
          ) : (
            venue.name
          )}
        </p>
      )}

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the table horizontally. */}
      <section className="game-detail__table-scroll" aria-label="Marcador por cuartos" tabIndex={0}>
        <table className="quarter-scores">
          <caption>Marcador por cuartos</caption>
          <thead>
            <tr>
              <th scope="col">Equipo</th>
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
                    <ClubLogo team={side.club} />
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

      <GameVideo url={game.video} homeName={homeClub.name} awayName={awayClub.name} />

      <Tabs label="Detalle del partido" tabs={tabs} />
    </article>
  );
}

export default function GamePage() {
  const { slug } = useParams();
  const [state, setState] = useState({ slug: null, status: 'loading', game: null });
  const game = state.slug === slug ? state.game : null;
  const status = state.slug === slug ? state.status : 'loading';

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
        if (active) setState({ slug, status: 'ready', game: { ...data, date: new Date(data.date) } });
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
      {status === 'loading' && <p role="status">Cargando…</p>}
      {status === 'not-found' && <p>Partido no encontrado.</p>}
      {status === 'error' && <p role="alert">No se pudo cargar el partido.</p>}
      {game && <GameDetail game={game} />}
    </main>
  );
}
