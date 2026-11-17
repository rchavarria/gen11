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

function renderPage(path = '/competitions') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CompetitionsPage />
      <Location />
    </MemoryRouter>,
  );
}

test('navigates competition, phase and group, round, and games through URL parameters', async () => {
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
  screen.getByRole('region', { name: 'Jornada 5', exact: true }).getBoundingClientRect = () => ({ top: 1200 });

  fireEvent.click(await screen.findByRole('button', { name: 'J01' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s67-kdt-oro&ph=f1&g=g1&r=j01');
  await waitFor(() => expect(screen.getAllByText('Cadete Masculino LIGA AHORRAMAS - ORO').length).toBeGreaterThan(0));
  expect(document.querySelectorAll('.game-card')).toHaveLength(gameCount);
  expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 150, behavior: 'smooth' });
  expect(Element.prototype.scrollTo.mock.instances.at(-1)).toBe(gamesContainer);

  fireEvent.click(screen.getByRole('button', { name: 'J05' }));
  expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith({ top: 1050, behavior: 'smooth' });
  expect(Element.prototype.scrollTo.mock.instances.at(-1)).toBe(gamesContainer);
  fireEvent.click(screen.getByRole('button', { name: 'J05' }));
  expect(Element.prototype.scrollTo).toHaveBeenCalledTimes(3);
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  expect(document.querySelectorAll('.game-card')).toHaveLength(gameCount);
});

test('scrolls to a URL-selected round after the competition loads without hiding other rounds', async () => {
  renderPage('/competitions?c=s67-kdt-oro&ph=f1&g=g1&r=j05');

  await waitFor(() => expect(Element.prototype.scrollTo).toHaveBeenCalled());
  expect(Element.prototype.scrollTo.mock.instances.at(-1)).toBe(
    screen.getByRole('region', { name: 'Jornada 5', exact: true }).parentElement,
  );
  expect(screen.getByRole('region', { name: 'Jornada 1', exact: true })).toBeInTheDocument();
});

test('uses just the phase for competitions without groups', async () => {
  renderPage('/competitions?c=s56-kdt-oro');

  fireEvent.click(screen.getByRole('button', { name: 'Tercera fase' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s56-kdt-oro&ph=f3');
  expect(await screen.findByRole('button', { name: 'J01' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Jornada 1', exact: true })).toBeInTheDocument();
});

test('ignores a phase/group selection that is invalid for the selected competition', () => {
  renderPage('/competitions?c=s67-kdt-oro&ph=invalid&g=unknown&r=j01');

  expect(screen.getAllByRole('button', { name: 'Cadete Oro', exact: true })[0]).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: 'Fase + Grupo' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Jornada', exact: true })).not.toBeInTheDocument();
});
