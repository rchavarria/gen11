// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import GameVideo from './GameVideo.jsx';

const props = { homeName: 'Local', awayName: 'Visitante' };

test('embeds YouTube with an accessible title, start time and fullscreen support', () => {
  render(<GameVideo {...props} url="https://youtu.be/go9AWn84-pg?t=1m30s" />);
  const frame = screen.getByTitle('Video: Local Vs Visitante');
  expect(screen.getByRole('region', { name: 'Video del partido' })).toContainElement(frame);
  expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/go9AWn84-pg?start=90');
  expect(frame).toHaveAttribute('allowfullscreen');
  expect(frame).toHaveAttribute('loading', 'lazy');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test.each([undefined, null, '', 'not a URL', 'javascript:alert(1)', 'data:text/html,test'])(
  'renders nothing for a missing or unsafe video URL: %s',
  (url) => {
    const { container } = render(<GameVideo {...props} url={url} />);
    expect(container).toBeEmptyDOMElement();
  },
);

test.each(['https://example.com/video', 'https://youtube.com/watch?v=invalid'])(
  'shows a named fallback link instead of an iframe for %s',
  (url) => {
    render(<GameVideo {...props} url={url} />);
    const link = screen.getByRole('link', { name: 'Local Vs Visitante' });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByTitle('Video: Local Vs Visitante')).not.toBeInTheDocument();
  },
);
