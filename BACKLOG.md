# Backlog

## To Do list

- `ApiClient`: renovar la key automáticamente (`renewKey()`) cuando la API responda "Faltan parámetros", y reintentar la petición una vez
- web: mostrar el detalle del partido con marcador por cuartos y añadir estadísticas por dorsal (datos de marcador en `src/data/games/<slug>.json`)
- web: gráfica de evolución del marcador, enlace a vídeo, filtro por categoría
- web: añadir escudos de los clubs en `src/web/public/logos/` y su `logo` en `src/data/clubs.json`

## Done list

- 2026-11-03: paso 6 de `sync.js`: generar `src/data/games/<slug>.json` con datos del partido, slugs de clubs, marcador y parciales por periodo (incluidas prórrogas)
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
