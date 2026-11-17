// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, test } from 'vitest';
import CompetitionsPage from './CompetitionsPage.jsx';

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

  fireEvent.click(await screen.findByRole('button', { name: 'J01' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s67-kdt-oro&ph=f1&g=g1&r=j01');
  await waitFor(() => expect(screen.getAllByText('Cadete Masculino LIGA AHORRAMAS - ORO').length).toBeGreaterThan(0));
  expect(screen.getByText('REAL MADRID ´A´')).toBeInTheDocument();
});

test('uses just the phase for competitions without groups', async () => {
  renderPage('/competitions?c=s56-kdt-oro');

  fireEvent.click(screen.getByRole('button', { name: 'Tercera fase' }));
  expect(screen.getByTestId('location')).toHaveTextContent('?c=s56-kdt-oro&ph=f3');
  expect(await screen.findByRole('button', { name: 'J01' })).toBeInTheDocument();
});

test('ignores a phase/group selection that is invalid for the selected competition', () => {
  renderPage('/competitions?c=s67-kdt-oro&ph=invalid&g=unknown&r=j01');

  expect(screen.getAllByRole('button', { name: 'Cadete Oro', exact: true })[0]).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: 'Fase + Grupo' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Jornada', exact: true })).not.toBeInTheDocument();
});
