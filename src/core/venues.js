'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

async function loadVenues() {
  const venues = JSON.parse(await fs.readFile(path.join(__dirname, '../data/venues.json'), 'utf8'));
  return new Map(venues.map((venue) => [venue.name, venue.slug]));
}

module.exports = { loadVenues };
