# Diseño de la web de partidos

## Objetivo

Web para seguir partidos de baloncesto, principalmente de la generación 2011
(también de otros años y temporadas futuras). Uso familiar, pero acceso público.

## Privacidad

- Jugadores: solo el **dorsal**, nunca el nombre
- Tampoco se publican nombres de entrenadores
- El calendario omite ids de la fuente; los JSON de detalle conservan `id`,
  publicado en los chunks de datos aunque no se muestra en pantalla
- Equipos: se muestra el **nombre del club**
- Sin buscadores: `<meta name="robots" content="noindex, nofollow">` y `robots.txt` con `Disallow: /`

## Arquitectura

- Web estática: React + Vite + React Router (`HashRouter`) + Chart.js (cuando haya gráficas)
- Publicada en GitHub Pages (`.github/workflows/pages.yml`)
- Código de la web en `src/web/`
- Datos procesados en `src/data/` (se comitean)
- Escudos en `src/web/public/logos/<slug-del-club>.png|jpg`

## Datos

- `src/build-data.js` lee los datos en bruto de `downloads/` y genera `src/data/calendar.json`
  - lee `dated-games.json` para obtener slug, fecha, hora, categoría y clubs
  - combina esos datos con su marcador (`games-scores/`) por id de partido;
    considera jugado un partido finalizado o con ambas puntuaciones presentes
  - sin fichero de marcador, lo considera no jugado y deja las puntuaciones vacías
  - omite los partidos sin slug o con id inválido
  - escribe solo los campos de una lista blanca
- Cada `home` y `away` guarda `club` (slug de un club existente) y `score`.
  La web obtiene el nombre y el escudo desde `clubs.json`, sin duplicarlos en el calendario.
  El generador falla antes de escribir si no puede resolver un club; su nombre de la
  fuente debe estar en `sourceNames`.
- También genera `src/data/games/<slug>.json` para partidos con ambos marcadores:
  conserva los datos del partido (incluido `id`), omitiendo `homeClubName`,
  `awayClubName`, `downloaded` y `scored`. Añade `home` y `away` con `slug`, `score`
  y `quarterScores` ordenados por periodo, incluidas las prórrogas.
  La página de detalle carga cada JSON de forma lazy mediante `import.meta.glob`.
- Slug del partido: lo añades a mano en `dated-games.json` antes de procesarlo;
  es el id estable (el `id_partido` de la fuente caduca)
- `src/data/clubs.json` (a mano): `slug`, `name` (el que se muestra), `logo` (fichero en
  `public/logos/`, o `null`) y `sourceNames` (nombres del club en la fuente)
- Vídeos: enlaces añadidos a mano (pendiente)

## Página principal: calendario

- Selector de mes arriba (‹ Octubre 2026 ›); el mes va en la URL (`/#/?mes=2026-10`)
- Bloques por semana, de lunes a domingo
- Una semana que cruza dos meses aparece en ambos
- Semanas sin partidos: se muestra «Sin partidos»
- Al abrir, se muestra la semana actual
- Se muestran todos los partidos, pasados y próximos

### Tarjeta de partido

- Nombre y escudo de ambos clubs (iniciales si no hay escudo)
- Resultado (si se ha jugado)
- Fecha y hora
- Categoría
- Sin pabellón
- Solo los partidos con ambos marcadores enlazan al detalle; los demás no son clicables

## Página de detalle: `/#/game/:slug`

- Cabecera con categoría, fecha y hora (`HH:MM`; se omite si es desconocida)
- Logos y nombres de ambos clubs, resueltos desde `clubs.json`
- Marcador total en grande, con la puntuación ganadora en negrita
- Tabla de parciales: Q1–Q4, OT/OT2… para las prórrogas y columna Total
- Enlace de vuelta al calendario en el mes del partido
- Estados de carga, partido no encontrado y error de carga

### Pendiente

- Estadísticas de jugadores (por dorsal); columnas por decidir
- Gráfica de evolución del marcador
- Enlace o vídeo embebido
- Filtro por categoría
