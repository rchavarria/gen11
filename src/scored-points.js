#!/usr/bin/env node
/**
 * Extracts scored points (CANASTA-1P, CANASTA-2P and CANASTA-3P) from a game score JSON.
 * The output should be a JSON object useful for creating a timeline of scored points,
 * ideally, on the browser, generated with three.js or similar libraries.
 *
 * Usage:
 *   node src/scored-points.js <input.json>
 *
 * The resulting JSON object is always written to stdout. Redirect stdout to save it.
 */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const SCORING_ACTION_TYPES = new Set(['CANASTA-1P', 'CANASTA-2P', 'CANASTA-3P']);
function getActionTimeMs(action) {
  const period = Number(action.numero_periodo);
  if (!Number.isInteger(period) || period < 1 || period > 4) {
    throw new Error(`numero_periodo no válido: ${action.numero_periodo}`);
  }

  const time = action.tiempo_partido;
  const match = typeof time === 'string' && time.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d))?$/);
  if (!match) {
    throw new Error(`Formato de tiempo no válido: ${time}`);
  }

  const [, hours, minutes, seconds, tenths = '0'] = match;
  const elapsedMs =
    (Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds)) * 1000 + Number(tenths) * 100;
  const periodOffsetMs = (4 - period) * 10 * 60 * 1000;
  return periodOffsetMs + elapsedMs;
}

function getScoredPoints(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('El JSON debe contener un objeto en la raíz.');
  }

  const actions = data.envivo && data.envivo.historialacciones;
  if (!Array.isArray(actions)) {
    throw new Error('No se encontró el array envivo.historialacciones.');
  }

  return {
    home_team: data.partido && data.partido.local,
    away_team: data.partido && data.partido.visitante,
    actions: actions
      .filter((action) => action && SCORING_ACTION_TYPES.has(action.accion_tipo))
      .map((action) => ({
        timestamp: getActionTimeMs(action),
        jersey: action.dorsal,
        home_points: action.puntos_local,
        away_points: action.puntos_visitante,
      })),
  };
}

async function main() {
  const [, , inputArg] = process.argv;
  if (!inputArg || process.argv.length !== 3) {
    throw new Error('Usage: node src/scored-points.js <input.json>');
  }

  const inputPath = path.resolve(inputArg);
  const input = await fs.readFile(inputPath, 'utf8');
  const scoredPoints = getScoredPoints(JSON.parse(input));
  const output = `${JSON.stringify(scoredPoints, null, 2)}\n`;
  process.stdout.write(output);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  });
}



