# Diseño de la web de partidos

## Objetivo

Web para seguir partidos de baloncesto, principalmente de la generación 2011
(también de otros años y temporadas futuras). Uso familiar, pero acceso público.

## Privacidad

- Jugadores: solo el **dorsal**, nunca el nombre
- Tampoco se publican nombres de entrenadores ni ids de la fuente
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
  - cruza `games.json` con los resultados de búsqueda (`games/`) y los próximos partidos
    (`next-games/`) por id de partido, para obtener hora, categoría, clubs y resultado
  - si un partido no aparece en las búsquedas, usa su marcador (`games-scores/`)
  - omite los partidos que aún no tienen id
  - escribe solo los campos de una lista blanca
- Se guardan tanto el equipo como el club, aunque solo se muestra el club
- Slug del partido: lo añades a mano en `games.json` antes de procesarlo;
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

## Página de detalle: `/#/partido/:slug`

- Cabecera: igual que la tarjeta
- Partido no jugado: solo la cabecera

### Pendiente

- Marcador completo por cuartos
- Estadísticas de jugadores (por dorsal); columnas por decidir
- Gráfica de evolución del marcador
- Enlace o vídeo embebido
- Filtro por categoría
