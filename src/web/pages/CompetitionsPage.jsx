import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import competitionsData from '../../data/competitions.json';
import standingsData from '../../data/standings.json';
import teams from '../../data/teams.json';
import GameCard from '../components/GameCard.jsx';
import { findRounds, phaseGroupOptions, roundLabel, sortRounds, toCardGame } from '../lib/competitions.js';

const competitions = competitionsData.competitions;
const competitionFiles = import.meta.glob('../../data/s*-*-*.json', { import: 'default' });
const teamsBySlug = new Map(teams.map((team) => [team.slug, team]));

function Chips({ label, options, selectedId, onSelect }) {
  return (
    <fieldset className="competitions__chips">
      <legend className="competitions__legend">{label}</legend>
      {options.map((option) => (
        <button
          type="button"
          key={option.id}
          className={`competitions__chip${option.id === selectedId ? ' competitions__chip--active' : ''}`}
          aria-pressed={option.id === selectedId}
          title={option.title}
          onClick={() => onSelect(option)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

export default function CompetitionsPage() {
  const [params, setParams] = useSearchParams();
  const competition = competitions.find((item) => item.id === params.get('c'));
  const phases = useMemo(() => (competition ? phaseGroupOptions(competition) : []), [competition]);
  const phaseOption = phases.find(
    (option) => option.phaseId === params.get('ph') && (option.groupId ?? null) === (params.get('g') || null),
  );
  const treeKey =
    competition && phaseOption ? `${competition.id}/${phaseOption.phaseId}/${phaseOption.groupId ?? ''}` : null;
  const [treeState, setTreeState] = useState(null);
  const roundRefs = useRef({});
  const gamesRef = useRef(null);
  const scrollToRound = useCallback((roundId) => {
    const container = gamesRef.current;
    const round = roundRefs.current[roundId];
    if (!container || !round) return;
    container.scrollTo({
      top: container.scrollTop + round.getBoundingClientRect().top - container.getBoundingClientRect().top,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    if (!treeKey || !competition) return undefined;
    let active = true;
    const loadTree = competitionFiles[`../../data/${competition.id}.json`];
    if (!loadTree) {
      setTreeState({ key: treeKey, error: new Error(`No existe el árbol de ${competition.id}.`) });
      return undefined;
    }

    setTreeState({ key: treeKey, loading: true });
    loadTree()
      .then((tree) => {
        if (active) setTreeState({ key: treeKey, tree });
      })
      .catch((error) => {
        if (active) setTreeState({ key: treeKey, error });
      });
    return () => {
      active = false;
    };
  }, [competition, treeKey]);

  const rounds = useMemo(
    () =>
      treeState?.key === treeKey && treeState.tree
        ? sortRounds(findRounds(treeState.tree, phaseOption.phaseId, phaseOption.groupId))
        : [],
    [treeState, treeKey, phaseOption],
  );
  const requestedRound = params.get('r');
  const selectedRound = rounds.find(
    (round) =>
      round.id.toLowerCase() === requestedRound?.toLowerCase() ||
      roundLabel(round.id, true).toLowerCase() === requestedRound?.toLowerCase(),
  );
  const selectedRoundIndex = selectedRound ? rounds.indexOf(selectedRound) : 0;
  const loading = treeKey && (treeState?.key !== treeKey || treeState.loading);
  const error = treeState?.key === treeKey ? treeState.error : null;
  const standingsPhase = standingsData.competitions
    .find((item) => item.id === competition?.id)
    ?.phases.find((phase) => phase.id === phaseOption?.phaseId);
  const standings = phaseOption?.groupId
    ? standingsPhase?.groups?.find((group) => group.id === phaseOption.groupId)?.standings
    : standingsPhase?.standings;

  useEffect(() => {
    if (selectedRound) {
      scrollToRound(selectedRound.id);
    }
  }, [selectedRound, scrollToRound]);

  function chooseCompetition(option) {
    setParams({ c: option.id });
  }

  function choosePhase(option) {
    setParams({
      c: competition.id,
      ph: option.phaseId,
      ...(option.groupId ? { g: option.groupId } : {}),
    });
  }

  function navigateToRound(index) {
    const round = rounds[index];
    if (!round || !competition || !phaseOption) return;
    setParams({
      c: competition.id,
      ph: phaseOption.phaseId,
      ...(phaseOption.groupId ? { g: phaseOption.groupId } : {}),
      r: roundLabel(round.id, true).toLowerCase(),
    });
    if (selectedRound?.id === round.id) scrollToRound(round.id);
  }

  const phaseGroupId = phaseOption?.id ?? null;

  return (
    <main className="competitions page">
      <div className="competitions__filters">
        <section className="competitions__section competitions__filter" aria-labelledby="competitions-title">
          <h2 id="competitions-title">Competición</h2>
          <Chips
            label="Competiciones"
            options={competitions.map((item) => ({
              id: item.id,
              label: item.shortName,
              title: item.category,
            }))}
            selectedId={competition?.id}
            onSelect={chooseCompetition}
          />
        </section>

        {competition && (
          <section className="competitions__section competitions__filter" aria-labelledby="phase-title">
            <h2 id="phase-title">Fase + Grupo</h2>
            <Chips label="Fases y grupos" options={phases} selectedId={phaseGroupId} onSelect={choosePhase} />
          </section>
        )}

        {phaseOption && (
          <section className="competitions__section competitions__filter" aria-labelledby="round-title">
            <h2 id="round-title">Jornada</h2>
            {loading && <p role="status">Cargando jornadas…</p>}
            {error && <p role="alert">No se pudo cargar la competición: {error.message}</p>}
            {!loading && !error && rounds.length === 0 && <p>No hay jornadas disponibles.</p>}
            {!loading && !error && rounds.length > 0 && (
              <nav className="competitions__chips competitions__round-nav" aria-label="Navegación por jornadas">
                <button
                  type="button"
                  className="competitions__round-button"
                  onClick={() => navigateToRound(0)}
                  title="Ir a la primera jornada"
                  aria-label="Inicio"
                >
                  <span aria-hidden="true">⏮️</span>
                </button>
                <button
                  type="button"
                  className="competitions__round-button"
                  onClick={() => navigateToRound(selectedRoundIndex - 1)}
                  disabled={selectedRoundIndex === 0}
                  title="Ir a la jornada anterior"
                  aria-label="Atrás 1"
                >
                  <span aria-hidden="true">◀️</span>
                </button>
                <button
                  type="button"
                  className="competitions__chip"
                  onClick={() => gamesRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  Clasificación
                </button>
                <button
                  type="button"
                  className="competitions__round-button"
                  onClick={() => navigateToRound(selectedRoundIndex + 1)}
                  disabled={selectedRoundIndex >= rounds.length - 1}
                  title="Ir a la jornada siguiente"
                  aria-label="Adelante 1"
                >
                  <span aria-hidden="true">▶️</span>
                </button>
                <button
                  type="button"
                  className="competitions__round-button"
                  onClick={() => navigateToRound(rounds.length - 1)}
                  disabled={selectedRoundIndex >= rounds.length - 1}
                  title="Ir a la última jornada"
                  aria-label="Final"
                >
                  <span aria-hidden="true">⏭️</span>
                </button>
              </nav>
            )}
          </section>
        )}
      </div>

      <div className="competitions__games" ref={gamesRef} key={treeKey}>
        {phaseOption && (
          <section className="competitions__section" aria-labelledby="standings-title">
            <h2 id="standings-title">Clasificación</h2>
            {standings?.length ? (
              // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the table horizontally.
              <section className="game-detail__table-scroll" aria-label="Tabla de clasificación" tabIndex={0}>
                <table className="quarter-scores competitions__standings">
                  <caption>{phaseOption.label}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Equipo</th>
                      <th scope="col" title="Partidos jugados">
                        PJ
                      </th>
                      <th scope="col" title="Partidos ganados">
                        PG
                      </th>
                      <th scope="col" title="Partidos perdidos">
                        PP
                      </th>
                      <th scope="col" title="Puntos a favor">
                        PF
                      </th>
                      <th scope="col" title="Puntos en contra">
                        PC
                      </th>
                      <th scope="col" title="Puntos de clasificación">
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((entry) => (
                      <tr key={entry.team}>
                        <th scope="row">{teamsBySlug.get(entry.team)?.name ?? entry.team}</th>
                        <td>{entry.gamesPlayed}</td>
                        <td>{entry.wins}</td>
                        <td>{entry.losses}</td>
                        <td>{entry.pointsFor}</td>
                        <td>{entry.pointsAgainst}</td>
                        <td>{entry.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : (
              <p>Clasificación no disponible.</p>
            )}
          </section>
        )}
        {rounds.map((round) => (
          <section
            key={round.id}
            className="competitions__section competitions__round"
            aria-labelledby={`games-title-${round.id}`}
            ref={(node) => {
              roundRefs.current[round.id] = node;
            }}
          >
            <h2 id={`games-title-${round.id}`}>{roundLabel(round.id)}</h2>
            {round.games.length === 0 ? (
              <p>No hay partidos en esta jornada.</p>
            ) : (
              <div className="week__games">
                {round.games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={toCardGame(game, {
                      competition,
                      phaseId: phaseOption.phaseId,
                      groupId: phaseOption.groupId,
                      roundId: round.id,
                    })}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
