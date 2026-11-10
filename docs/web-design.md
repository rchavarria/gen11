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

## Tipografías

- Bricolage Grotesque
- Montserrat
- Coolvetica

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
  Si existe el fichero de estadísticas del partido, añade también `players` a `home` y `away`
  (sin la fila `TOTALES`): `jersey`, `msPlayed`, `starter`, `freeThrows`, `twoPointers`,
  `threePointers` (`made`/`attempted`), `rebounds` (`defensive`/`offensive`), `assists`,
  `turnovers`, `steals`, `blocks` (`made`/`received`), `fouls` (`committed`/`received`),
  `plusMinus` y `efficiency`.
  Cada equipo incluye también `timelyScores`: objetos `{time, score, jersey}` extraídos
  de las acciones de `games-scores/`, con tiempo transcurrido en ms, tanteo acumulado
  y dorsal. Comienzan con `{time: 0, score: 0, jersey: null}` y se ordenan por tiempo
  y, en los empates, por tanteo total. Los cuartos duran 10 minutos y las prórrogas 5.
  Si falta el historial o sus datos son inválidos, ambos arrays quedan vacíos y el
  generador emite un aviso con el slug. Un historial válido vacío conserva solo los puntos iniciales.
  La página de detalle carga cada JSON de forma lazy mediante `import.meta.glob`.
- Slug del partido: lo añades a mano en `dated-games.json` antes de procesarlo;
  es el id estable (el `id_partido` de la fuente caduca)
- `src/data/clubs.json` (a mano): `slug`, `initials` (3 letras, se muestran en la tira de
  próximos partidos), `name` (el que se muestra), `logo` (fichero en
  `public/logos/`, o `null`) y `sourceNames` (nombres del club en la fuente)
- Vídeos: enlaces añadidos a mano (pendiente)

## Página principal: calendario

### Tira de próximos partidos

- Arriba del todo, a todo el ancho y con fondo oscuro
- Partidos sin marcador con fecha de hoy en adelante, ordenados por fecha y hora
- Tarjetas pequeñas: categoría corta (`CAD`, `JUN`), hora (si se conoce), fecha,
  y escudo + `initials` de ambos clubs (local arriba)
- Scroll horizontal con botones ‹ › a los lados (ocultos en móviles táctiles)
- Las tarjetas no son clicables; si no hay próximos partidos no se muestra
- Los partidos con el slug `alcobendas` en cualquiera de los clubs se resaltan con un borde izquierdo rojo

### Calendario

- Selector de mes arriba (‹ Octubre 2026 ›); el mes va en la URL (`/#/?mes=2026-10`)
- Bloques por semana, de lunes a domingo
- Una semana que cruza dos meses aparece en ambos
- Semanas sin partidos: se muestra «Sin partidos»
- Al abrir, se muestra la semana actual (solo hace scroll si no está visible, para no ocultar la tira)
- Se muestran todos los partidos, pasados y próximos

### Tarjeta de partido

- Nombre y escudo de ambos clubs (iniciales si no hay escudo)
- Resultado (si se ha jugado)
- Fecha y hora
- Categoría
- Sin pabellón
- Solo los partidos con ambos marcadores enlazan al detalle; los demás no son clicables
- Los partidos con el slug `alcobendas` en cualquiera de los clubs se resaltan con un borde izquierdo rojo, jugados o pendientes

## Página de detalle: `/#/game/:slug`

- Cabecera con categoría, fecha y hora (`HH:MM`; se omite si es desconocida)
- Logos y nombres de ambos clubs, resueltos desde `clubs.json`
- Marcador total en grande, con la puntuación ganadora en negrita
- Tabla de parciales: Q1–Q4, OT/OT2… para las prórrogas y columna Total
- Debajo de los parciales, pestañas (estado local, no van en la URL): boxscore del club local,
  boxscore del club visitante (con el nombre del club), «Evolución del marcador» y
  «Jugada a jugada». Los dos boxscores son una tabla con dorsal, minutos (`mm:ss`), puntos
  (tiros libres + 2×dobles + 3×triples), valoración y +/-, ordenada por dorsal (los no numéricos,
  al final) y con una fila de totales (puntos y valoración). Sin `players` muestran
  «Estadísticas no disponibles.».
- «Evolución del marcador» muestra dos líneas Chart.js suavizadas: local roja y
  visitante azul, con leyenda con los nombres de los clubs. Usa `home.timelyScores`
  y `away.timelyScores`, sin nuevas peticiones. El eje X muestra minutos transcurridos
  (0–40, ampliado por prórrogas) y el Y, puntos acumulados. Los tooltips muestran
  tiempo `mm:ss`, club, tanteo y dorsal (salvo el punto inicial sin dorsal).
  El gráfico se adapta al ancho disponible y se destruye al abandonar la pestaña.
  Sin canastas en ambos equipos muestra «Evolución del marcador no disponible.»;
  si solo hay datos de uno, muestra los disponibles.
- «Jugada a jugada» mantiene el mensaje provisional.
- Enlace de vuelta al calendario en el mes del partido
- Estados de carga, partido no encontrado y error de carga

### Pendiente

- Más columnas en el boxscore (tiros, rebotes, asistencias…)
- Enlace o vídeo embebido
- Filtro por categoría
