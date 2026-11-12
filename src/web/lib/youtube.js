function startSeconds(value) {
  if (!value) return null;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : match
      ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)
      : null;
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

/**
 * Converts supported YouTube URLs to privacy-enhanced embed URLs, preserving the start time.
 * Returns null for invalid URLs or unsupported video links.
 */
export function youtubeEmbedUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;

  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let id;
  if (host === 'youtu.be') {
    id = /^\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      url.pathname === '/watch'
        ? url.searchParams.get('v')
        : /^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  }
  // YouTube video IDs contain 11 letters, digits, underscores or hyphens.
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) return null;

  const start = startSeconds(url.searchParams.get('start') || url.searchParams.get('t'));
  return `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`;
}
