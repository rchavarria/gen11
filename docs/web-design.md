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
  - lee los árboles de competición (`src/data/<competición>.json`, ver `competitions.json`)
    para obtener `date`, equipos y `venue` (slug del pabellón); la categoría sale de la competición
    y el slug se calcula a partir de la posición del partido en el árbol
  - `home` y `away` del árbol son objetos con `slug` y `score` (inicialmente `null`);
    el marcador se rellena con los datos descargados. En partidos pendientes, un equipo
    desconocido conserva su nombre de equipo `name` hasta poder resolverlo en `teams.json`
  - `date` es ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`); la web muestra el día y la hora en Europe/Madrid.
    `T00:00:00Z` indica hora desconocida y conserva el día del partido
  - al cargar el calendario o un partido, la web convierte `date` en un objeto `Date`
  - las correcciones manuales de `venue` se hacen en el árbol de la competición;
    el calendario se regenera desde ese origen, sin leer sus valores anteriores
  - combina esos datos con su marcador (`games-scores/<id>.json`) por id de partido;
    considera jugado un partido finalizado o con ambas puntuaciones presentes
  - sin fichero de marcador, lo considera no jugado y deja las puntuaciones vacías
  - omite los partidos de `pending-games` y los que tienen id inválido
  - escribe solo los campos de una lista blanca
- Cada `home` y `away` del calendario guarda `club` (se mantiene el campo, pero contiene
  el slug del equipo) y `score`. La web obtiene nombre de equipo, iniciales y escudo
  desde `teams.json`, sin duplicarlos en el calendario.
  El generador falla antes de escribir si no puede resolver un equipo; su `slug` debe
  existir en `teams.json` o su nombre de equipo debe coincidir con `name`, normalizando
  espacios exteriores y mayúsculas. No se busca por club ni por `sourceNames`.
  Los próximos partidos se resuelven por `NombreEquipoLocal` y `NombreEquipoVisitante`.
- También genera `src/data/games/<slug>.json` para partidos con ambos marcadores:
  conserva los datos del partido (incluido `id`), omitiendo `downloaded` y `scored`.
  Sustituye `home` y `away` del árbol por objetos con `slug`, `score`
  y `quarterScores` ordenados por periodo, incluidas las prórrogas.
  El campo opcional `video` también se conserva. En el detalle se muestra debajo
  del marcador por cuartos, antes de las pestañas: un reproductor de YouTube
  (`youtube-nocookie.com`, sin reproducción automática), respetando el tiempo de
  inicio de la URL. Si no se reconoce la URL, se muestra un enlace en un recuadro
  a todo el ancho, con el texto «<club local> Vs <club visitante>».
  Solo se admiten URLs HTTP(S); si no hay video, no se muestra ningún bloque.
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
- Slug del partido: no se guarda; se calcula como
  `<competición>-<fase>[-<grupo>]-<jornada>-<local>-<visitante>` con los slugs de `teams.json`.
  Los partidos se identifican por `id` (`IdPartido` de la fuente). Los nuevos entran en
  `pending-games` y se colocan a mano en su jornada
- `src/data/teams.json` (a mano): `slug`, `initials` (se muestran en la tira de
  próximos partidos), `name` (nombre del equipo en la fuente y en la web), `club`
  (metadato del club, no se usa para resolver slugs) y `logo` (fichero en
  `public/logos/`, o `null`). Los slugs y nombres normalizados son únicos.
  Cambiar un slug exige migrar referencias y regenerar calendario y detalles;
  las URLs cambian y se retiran los detalles reemplazados, sin redirecciones.
- `src/data/venues.json` (a mano): `slug`, `name` (campo de juego) y `address`.
  Al obtener los próximos partidos, `CampoJuego` se compara literalmente con `name`,
  sin normalizar espacios, mayúsculas ni acentos. Se guarda o actualiza `venue` en el árbol de la competición; si no
  hay coincidencia, se conserva el valor existente (o `""` en partidos nuevos) y se
  avisa sin abortar. Solo se actualiza un slug existente si el nuevo es distinto y
  no está vacío. No se usan coincidencias
  parciales: «PISTA 1» no coincide con «PISTA 1-3».
- Vídeos: enlaces añadidos a mano (pendiente)

## Página principal: calendario

### Tira de próximos partidos

- Fija arriba, a todo el ancho y con fondo oscuro, también al desplazarse
- Partidos sin marcador con fecha de hoy en adelante, ordenados por fecha y hora
- Tarjetas pequeñas: categoría corta (`CAD`, `JUN`), hora (si se conoce), fecha,
  y escudo + `initials` de ambos clubs (local arriba)
- Scroll horizontal con botones ‹ › a los lados (ocultos en móviles táctiles)
- Las tarjetas no son clicables; si no hay próximos partidos se indica en la tira
- Los partidos con un equipo del club `BALONCESTO ALCOBENDAS` se resaltan con un borde izquierdo rojo

### Calendario

- Selector de mes arriba (‹ Octubre 2026 ›); el mes va en la URL (`/#/?m=2026-10`)
- Bloques por semana, de lunes a domingo
- Una semana que cruza dos meses aparece en ambos
- Semanas sin partidos: se muestra «Sin partidos»
- Al abrir el mes actual, se desplaza a la semana actual sin ocultarla tras la cabecera;
  al cambiar de mes, se muestra su inicio
- Se muestran todos los partidos, pasados y próximos

En el detalle, debajo del marcador y la fecha/hora, se muestra 📍 y el nombre
del pabellón. Si tiene `maps`, el nombre enlaza a Google Maps en nueva pestaña;
sin URL HTTP(S) válida se muestra como texto. Si no se conoce el pabellón,
no se muestra el bloque.

### Tarjeta de partido

- Nombre y escudo de ambos equipos (iniciales si no hay escudo)
- Resultado (si se ha jugado)
- Fecha y hora
- Categoría
- En partidos sin marcador completo, nombre del pabellón desde `venues.json` en un
  bloque a la izquierda (aproximadamente un cuarto del ancho y la misma altura que la categoría y ambos clubs), con los clubs
  a la derecha. El bloque muestra tres líneas: fecha, hora en negrita (si se conoce)
  y nombre del pabellón; fecha y hora se ocultan en la cabecera cuando aparece este
  bloque. El tooltip incluye nombre y dirección. Se omite si falta el pabellón.
- Solo los partidos con ambos marcadores enlazan al detalle; los demás no son clicables
- Los partidos con un equipo del club `BALONCESTO ALCOBENDAS` se resaltan con un borde izquierdo rojo, jugados o pendientes

## Página de competiciones: `/#/competitions`

- Enlace «Competiciones» en la cabecera del calendario.
- Navegación con chips por competición, fase+grupo, jornada y partidos. Las fases sin
  grupos se seleccionan directamente; cada competición, fase+grupo y jornada se guarda
  en los parámetros `c`, `ph`, `g` y `r` de la URL.
- Las competiciones y opciones de fase/grupo se leen de `competitions.json`; las jornadas
  y sus partidos, del árbol `src/data/<competición>.json`.
- Los partidos reutilizan las tarjetas del calendario y enlazan al detalle cuando tienen
  marcador completo.
- Los botones de jornadas usan etiquetas cortas: «J01», «J05», «J10».

## Página de detalle: `/#/game/:slug`

- Cabecera con categoría, fecha y hora (`HH:MM`; se omite si es desconocida)
- Logos y nombres de ambos equipos, resueltos desde `teams.json`
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
