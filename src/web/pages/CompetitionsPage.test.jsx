// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import CompetitionsPage from './CompetitionsPage.jsx';

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function Location() {
  const { search } = useLocation();
  return <output data-testid="location">{search}</output>;
}

function renderPage(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CompetitionsPage />
      <Location />
    </MemoryRouter>,
  );
}

test('navigates competition, phase, group, and rounds through URL parameters', async () => {
  renderPage();

  expect(screen.queryByRole('heading', { name: 'Competiciones' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Calendario/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Cadete Oro', exact: true })[0]);
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s67-kdt-oro');
  fireEvent.click(screen.getByRole('button', { name: 'Primera fase · Grupo 1' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s67-kdt-oro&ph=f1&g=g1');

  expect(await screen.findByRole('heading', { name: 'Jornada 1', exact: true })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Jornada 10', exact: true })).toBeInTheDocument();
  const gameCount = document.querySelectorAll('.game-card').length;
  expect(gameCount).toBeGreaterThan(3);
  expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
  const gamesContainer = screen.getByRole('region', { name: 'Jornada 1', exact: true }).parentElement;
  gamesContainer.getBoundingClientRect = () => ({ top: 200 });
  gamesContainer.scrollTop = 50;
  screen.getByRole('region', { name: 'Jornada 1', exact: true }).getBoundingClientRect = () => ({ top: 300 });
  screen.getByRole('region', { name: 'Jornada 2', exact: true }).getBoundingClientRect = () => ({ top: 600 });
  screen.getByRole('region', { name: 'Jornada 10', exact: true }).getBoundingClientRect = () => ({ top: 1200 });

  expect(screen.getByRole('button', { name: 'Inicio' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Atrás 1' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Adelante 1' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s67-kdt-oro&ph=f1&g=g1&r=j02');
  expect(document.querySelectorAll('.game-card')).toHaveLength(gameCount);
  await waitFor(() => expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 450, behavior: 'smooth' }));
  expect(Element.prototype.scrollTo.mock.instances.at(-1)).toBe(gamesContainer);

  fireEvent.click(screen.getByRole('button', { name: 'Atrás 1' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s67-kdt-oro&ph=f1&g=g1&r=j01');
  await waitFor(() => expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 150, behavior: 'smooth' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adelante 1' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s67-kdt-oro&ph=f1&g=g1&r=j02');
  await waitFor(() => expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 450, behavior: 'smooth' }));

  fireEvent.click(screen.getByRole('button', { name: 'Final' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s67-kdt-oro&ph=f1&g=g1&r=j10');
  expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 1050, behavior: 'smooth' });
  expect(Element.prototype.scrollTo.mock.instances.at(-1)).toBe(gamesContainer);
  expect(screen.getByRole('button', { name: 'Adelante 1' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Final' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Inicio' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s67-kdt-oro&ph=f1&g=g1&r=j01');
  await waitFor(() => expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 150, behavior: 'smooth' }));
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  expect(document.querySelectorAll('.game-card')).toHaveLength(gameCount);
});

test('scrolls to a URL-selected round after the competition loads without hiding other rounds', async () => {
  renderPage('/?c=s67-kdt-oro&ph=f1&g=g1&r=j07');

  await waitFor(() => expect(Element.prototype.scrollTo).toHaveBeenCalled());
  expect(Element.prototype.scrollTo.mock.instances.at(-1)).toBe(
    screen.getByRole('region', { name: 'Jornada 7', exact: true }).parentElement,
  );
  expect(screen.getByTestId('location')).toHaveTextContent('&r=j07');
  expect(screen.getByRole('region', { name: 'Jornada 1', exact: true })).toBeInTheDocument();
});

test('ignores the j URL parameter', async () => {
  renderPage('/?c=s67-kdt-oro&ph=f1&g=g1&j=J07');

  expect(await screen.findByRole('region', { name: 'Jornada 7', exact: true })).toBeInTheDocument();
  expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
});

test('uses just the phase for competitions without groups', async () => {
  renderPage('/?c=s56-kdt-oro');

  fireEvent.click(screen.getByRole('button', { name: 'Tercera fase' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s56-kdt-oro&ph=f3');
  expect(await screen.findByRole('button', { name: 'Inicio' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Jornada 1', exact: true })).toBeInTheDocument();

  const secondRound = screen.getByRole('region', { name: 'Jornada 2', exact: true });
  secondRound.parentElement.getBoundingClientRect = () => ({ top: 100 });
  secondRound.getBoundingClientRect = () => ({ top: 500 });
  fireEvent.click(screen.getByRole('button', { name: 'Adelante 1' }));

  expect(screen.getByTestId('location')).toHaveTextContent('?c=s56-kdt-oro&ph=f3&r=j02');
  await waitFor(() => expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 400, behavior: 'smooth' }));

  fireEvent.click(screen.getByRole('button', { name: 'Atrás 1' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s56-kdt-oro&ph=f3&r=j01');
});

test('ignores a phase/group selection that is invalid for the selected competition', () => {
  renderPage('/?c=s67-kdt-oro&ph=invalid&g=unknown&r=j01');

  expect(screen.getAllByRole('button', { name: 'Cadete Oro', exact: true })[0]).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: 'Fase + Grupo' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Jornada', exact: true })).not.toBeInTheDocument();
});
