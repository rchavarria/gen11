import { expect, test } from 'vitest';
import { youtubeEmbedUrl } from './youtube.js';

const id = 'go9AWn84-pg';
const embed = `https://www.youtube-nocookie.com/embed/${id}`;

test.each([
  `https://youtu.be/${id}`,
  `https://www.youtube.com/watch?v=${id}&feature=shared`,
  `https://m.youtube.com/watch?v=${id}`,
  `https://youtube.com/embed/${id}`,
  `https://www.youtube-nocookie.com/embed/${id}`,
  `https://youtube.com/shorts/${id}`,
  `https://www.youtube.com/live/${id}?si=share`,
])('converts %s to a privacy-enhanced embed URL', (url) => {
  expect(youtubeEmbedUrl(url)).toBe(embed);
});

test.each([
  ['t=90', 90],
  ['t=90s', 90],
  ['t=1m30s', 90],
  ['t=1h2m3s', 3723],
  ['start=120', 120],
  ['start=120&t=90', 120],
])('preserves the start time in %s', (query, seconds) => {
  expect(youtubeEmbedUrl(`https://youtu.be/${id}?${query}`)).toBe(`${embed}?start=${seconds}`);
});

test.each(['t=invalid', 't=-2', 't=0', 't=1.5', 't=999999999999999999999'])(
  'ignores an invalid or zero start time in %s',
  (query) => {
    expect(youtubeEmbedUrl(`https://youtu.be/${id}?${query}`)).toBe(embed);
  },
);

test.each([
  undefined,
  '',
  'not a URL',
  `https://example.com/watch?v=${id}`,
  `https://youtube.com.example.com/watch?v=${id}`,
  `https://notyoutube.com/watch?v=${id}`,
  `ftp://youtube.com/watch?v=${id}`,
  'https://youtube.com/watch',
  'https://youtu.be/invalid',
  `https://youtu.be/${id}/extra`,
  `https://youtube.com/channel/${id}`,
])('rejects unsupported URLs: %s', (url) => {
  expect(youtubeEmbedUrl(url)).toBeNull();
});
