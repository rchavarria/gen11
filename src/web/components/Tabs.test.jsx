// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tabs from './Tabs.jsx';

const tabs = [
  { id: 'home', label: 'Local', content: <p>Estadisticas locales</p> },
  { id: 'away', label: 'Visitante', content: <p>Estadisticas visitantes</p> },
  { id: 'evolution', label: 'Evolucion', content: <p>Evolucion del marcador</p> },
];

test('starts with the first tab and switches the accessible panel on click', async () => {
  const user = userEvent.setup();
  render(<Tabs tabs={tabs} label="Detalle del partido" />);

  const home = screen.getByRole('tab', { name: 'Local' });
  const away = screen.getByRole('tab', { name: 'Visitante' });
  expect(screen.getByRole('tablist')).toHaveAccessibleName('Detalle del partido');
  expect(home).toHaveAttribute('aria-selected', 'true');
  expect(home).toHaveAttribute('tabindex', '0');
  expect(away).toHaveAttribute('tabindex', '-1');
  expect(screen.getByRole('tabpanel', { name: 'Local' })).toHaveTextContent('Estadisticas locales');

  await user.click(away);

  const panel = screen.getByRole('tabpanel', { name: 'Visitante' });
  expect(panel).toHaveTextContent('Estadisticas visitantes');
  expect(away).toHaveAttribute('aria-controls', panel.id);
  expect(away).toHaveAttribute('aria-selected', 'true');
  expect(home).toHaveAttribute('aria-selected', 'false');
  expect(screen.queryByText('Estadisticas locales')).not.toBeInTheDocument();
});

test('supports arrow key wrapping, Home and End with focus following selection', async () => {
  const user = userEvent.setup();
  render(<Tabs tabs={tabs} label="Detalle del partido" />);
  const [home, away, evolution] = screen.getAllByRole('tab');
  await user.tab();
  expect(home).toHaveFocus();

  for (const [key, tab] of [
    ['{ArrowLeft}', evolution],
    ['{ArrowRight}', home],
    ['{ArrowRight}', away],
    ['{End}', evolution],
    ['{Home}', home],
  ]) {
    await user.keyboard(key);
    expect(tab).toHaveFocus();
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tab.id);
  }
});
