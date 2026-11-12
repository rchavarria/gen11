import { youtubeEmbedUrl } from '../lib/youtube.js';

/**
 * Embeds YouTube videos or links to other valid HTTP(S) URLs.
 * Renders nothing when the video URL is missing or invalid.
 */
export default function GameVideo({ url, homeName, awayName }) {
  if (!url) return null;
  const embedUrl = youtubeEmbedUrl(url);
  const title = `${homeName} Vs ${awayName}`;

  // Keep videos outside YouTube with valid URLs
  if (!embedUrl) {
    let link;
    try {
      link = new URL(url);
    } catch {
      return null;
    }
    if (!['http:', 'https:'].includes(link.protocol)) return null;
  }

  return (
    <section className="game-video" aria-label="Video del partido">
      {embedUrl ? (
        <iframe
          className="game-video__frame"
          src={embedUrl}
          title={`Video: ${title}`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <a className="game-video__link" href={url} target="_blank" rel="noopener noreferrer">
          {title}
        </a>
      )}
    </section>
  );
}
