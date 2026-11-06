// @vitest-environment jsdom
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let ClubLogo;

beforeAll(async () => {
  vi.stubEnv('BASE_URL', '/gen11/');
  ({ default: ClubLogo } = await import('./ClubLogo.jsx'));
});

afterAll(() => vi.unstubAllEnvs());

test('renders a decorative logo using the deployment base URL', () => {
  render(<ClubLogo club={{ name: 'Alcobendas', logo: 'alcobendas.png' }} />);

  expect(screen.getByAltText('')).toHaveAttribute('src', '/gen11/logos/alcobendas.png');
});

test.each([
  ['Club de Baloncesto', 'CB'],
  ['C.B. Alcobendas', 'A'],
  ['AB', 'AB'],
])('uses initials as a decorative fallback for %s', (name, initials) => {
  render(<ClubLogo club={{ name, logo: null }} />);

  expect(screen.queryByAltText('')).not.toBeInTheDocument();
  expect(screen.getByText(initials)).toHaveAttribute('aria-hidden', 'true');
});
