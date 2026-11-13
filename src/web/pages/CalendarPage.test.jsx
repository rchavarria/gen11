// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import CalendarPage from './CalendarPage.jsx';

vi.mock('../../data/calendar.json', () => ({
  default: [
    {
      slug: 'monday',
      date: '2026-11-01T23:30:00Z',
      category: 'Prueba lunes',
      played: true,
      home: { club: 'madrid', score: 10 },
      away: { club: 'canoe', score: 9 },
    },
    {
      slug: 'unknown',
      date: '2026-11-08T00:00:00Z',
      category: 'Prueba domingo',
      played: true,
      home: { club: 'madrid', score: 10 },
      away: { club: 'canoe', score: 9 },
    },
  ],
}));
vi.mock('../../data/clubs.json', () => ({
  default: [
    { slug: 'madrid', name: 'Madrid', initials: 'MAD', logo: null },
    { slug: 'canoe', name: 'Canoe', initials: 'CAN', logo: null },
  ],
}));
vi.mock('../../data/venues.json', () => ({ default: [] }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T23:30:00Z'));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.classList.contains('calendar-header')) return { height: 150 };
    if (this.classList.contains('week--current')) return { top: 600 };
    return { top: 0, height: 0 };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Location() {
  const { search } = useLocation();
  return <output data-testid="location">{search}</output>;
}

test('uses the Madrid month, groups local days in the correct week and navigates months', () => {
  render(
    <StrictMode>
      <MemoryRouter initialEntries={['/']}>
        <CalendarPage />
        <Location />
      </MemoryRouter>
    </StrictMode>,
  );
  expect(screen.getByRole('heading', { name: 'Noviembre 2026' })).toBeInTheDocument();
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 434, behavior: 'auto' });
  const header = screen.getByRole('region', { name: 'Próximos partidos' }).closest('.calendar-header');
  expect(within(header).getByRole('heading', { name: 'Noviembre 2026' })).toBeInTheDocument();
  const monday = screen.getByText('Prueba lunes').closest('section');
  const sunday = screen.getByText('Prueba domingo').closest('section');
  expect(monday).toBe(sunday);
  expect(within(monday).getByText(/lun 2 nov · 00:30/)).toBeInTheDocument();
  expect(within(sunday).getByText('dom 8 nov')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
  expect(screen.getByRole('heading', { name: 'Octubre 2026' })).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('?m=2026-10');
  fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
  expect(screen.getByRole('heading', { name: 'Diciembre 2026' })).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('?m=2026-12');
  expect(window.scrollTo).toHaveBeenCalledTimes(4);
  expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
});

test('honors the requested month', () => {
  render(
    <MemoryRouter initialEntries={['/?m=2027-01']}>
      <CalendarPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Enero 2027' })).toBeInTheDocument();
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
});
