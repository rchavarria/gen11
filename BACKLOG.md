# Backlog

## To Do list

- web: enlace a vídeo
- sync: primero, analizar qué y cuántos partidos hay que descargar, y luego descargar solo los partidos que no estén en `dated-games.json`, de forma que el contador/progeso de partidos descargados es "real", muestra el total de los que habría que descargar, no el total de los dated-games.json
- sync: generar ficheros sobre jugadores, con estadísticas de cada jugador en cada partido (puntos, rebotes, asistencias, valoración…)
- web: el recuadro del nombre del pabellon, incluye un enlace a Google Maps
- web: ampliar el boxscore con más columnas (tiros, rebotes, asistencias…)
- web: filtro por categoría
- web: rellenar la pestaña «Jugada a jugada», hoy es placeholder

## Done list

- 2026-11-11: sync: eliminar la generación de scored-points; `build-data.js` genera `timelyScores` al procesar cada partido
- 2026-11-11: web: los partidos sin marcador, deben mostrar el lugar del partido
- 2026-11-11: `ApiClient`: renovar la key automáticamente (`renewKey()`) cuando la API responda "Faltan parámetros", y reintentar la petición una vez
- 2026-11-10: web: rellenar pestaña «Evolución del marcador»
- 2026-11-10: web: gráfica de evolución del marcador
- 2026-11-06: app: linter y tests
- 2026-11-06: web: diseñar una paleta de colores
- 2026-11-06: web: resaltar los partidos donde juegue el club del usuario (por ejemplo, con un borde rojo)
- 2026-11-04: detalle web: boxscore local y visitante con dorsal, minutos, puntos, valoración y +/-
- 2026-11-04: detalle web: sección con pestañas (boxscore local, boxscore visitante, evolución del marcador, jugada a jugada) con contenido provisional
- 2026-11-03: detalle web en `/#/game/:slug`: categoría, fecha, hora, clubs, marcador total y tabla por cuartos con prórrogas; enlaces solo en partidos con marcador
- 2026-11-03: paso 6 de `sync.js`: generar `src/data/games/<slug>.json` con datos del partido, slugs de clubs, marcador y parciales por periodo (incluidas prórrogas)
- 2026-11-02: web: añadir escudos de los clubs en `src/web/public/logos/` y su `logo` en `src/data/clubs.json`
- 2026-11-01: `sync.js` (`npm run sync`): renueva la key, añade partidos nuevos a `games.json`, descarga, genera puntos anotados, `build-data` e informe en `sync-reports/`
- 2026-10-31: web estática (React + Vite) con calendario semanal, `build-data.js` y despliegue en GitHub Pages ([diseño](docs/web-design.md))
- 2026-10-28: `renew-key.js`: script para renovar la key de la API (registra de nuevo un `uid` fijo ya registrado; la API responde "uuid ya registrado" junto con una key nueva)
- 2026-10-28: implementar un "cliente" que agrupe las llamadas a la API, de forma que los scripts puedan usarlo y no tener que repetir la lógica de las llamadas a la API en cada script
- 2026-10-28: migrar descargas de stats/marcadores a `ApiClient` y eliminar `download-stats.js` y `download-scores.js` (cubiertos por `download-games.js`)
- 2026-10-27: filtrar partidos de la temporada pasada, los jugados por los cadetes de ambos años
  - solo se han encontrado los partidos del 2010, categoría oro, fase 1, 3 y playoffs
- 2026-10-27: mispartidos.ashx: ¿devuelve partidos pasados? ¿O solo los próximos?
  - Solo los próximos, los pasados hay que recuperarlos con `buscarPartido`
- 2026-10-23: scored-points.js debe generar un JSON válido para Chart.js, al estilo de [line chart](https://quickchart.io/sandbox)
- 2026-10-23: `download-stats.js`: descargar las estadísticas de cada partido jugado
- 2026-10-23: `download-scores.js`: descargar los marcadores de cada partido jugado
- 2026-10-15: completar api-reference para _próximos partidos_
- 2026-10-15: completar api-reference para estadísticas de un partido en vivo
- 2026-10-15: completar api-reference para marcador de un partido en vivo
- 2026-10-15: al buscar partidos, filtrar por categoria, u otros parámetros, a ver si vienen menos resultados y se puede acortar el número de peticiones
