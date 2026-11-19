import venues from '../../data/venues.json';

const venuesBySlug = new Map(venues.map((venue) => [venue.slug, venue]));

export function getVenue(slug) {
  return venuesBySlug.get(slug);
}

export function getVenueMapsUrl(venue) {
  if (!venue?.maps) return undefined;
  try {
    const url = new URL(venue.maps);
    if (['http:', 'https:'].includes(url.protocol)) return venue.maps;
  } catch {
    // Keep the venue visible as plain text when the URL is invalid.
  }
  return undefined;
}
