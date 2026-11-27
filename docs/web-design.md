# Diseño de la web de partidos

Web estática de uso familiar y acceso público. La interfaz está en `src/web/`
(React, Vite y React Router con rutas hash). Para ejecutar la web o actualizar
sus datos, consulta el [README](../README.md).

## Privacidad

Los jugadores se identifican solo por dorsal; no se publican nombres de jugadores
ni de entrenadores. El calendario omite el `id` de la fuente, pero el JSON público
de detalle lo conserva aunque no se muestre en pantalla. `noindex, nofollow` y
`robots.txt` desaconsejan la indexación; no restringen el acceso.

## Competiciones · `/#/competitions`

La portada y las rutas desconocidas llevan a la jornada destacada, que se cambia
en `HOME` (`src/web/main.jsx`). La URL conserva competición (`c`), fase (`ph`),
grupo opcional (`g`) y jornada (`r`): `/#/competitions?c=s67-kdt-oro&ph=f1&g=g2&r=j08`.

Al elegir fase o grupo se ven todas sus jornadas, ordenadas por identificador,
y los partidos de cada una por fecha y hora. Los botones ⏮️, ◀️, ▶️ y ⏭️ navegan
entre jornadas, actualizan `r` y desplazan la lista **sin filtrar** las demás.
El chip «Clasificación», entre las flechas, desplaza la lista hasta la tabla
anterior a la primera jornada sin cambiar la URL. La tabla muestra los datos
de `src/data/standings.json` correspondientes a la fase y grupo seleccionados;
si faltan, se indica que la clasificación no está disponible.
Los filtros siguen visibles y tienen
desplazamiento propio si ocupan más de media pantalla.

## Calendario · `/#/calendar`

Se accede por URL directa. El selector conserva el mes en la URL (`?m=2026-10`).
Las semanas van de lunes a domingo: una semana entre dos meses aparece en ambos
y las vacías indican «Sin partidos». El mes actual se abre en la semana en curso;
al cambiar de mes se muestra su inicio.

La tira fija superior muestra los próximos partidos sin marcador desde hoy, en
orden cronológico. Se recorre horizontalmente; sus tarjetas, con categoría,
fecha, hora si se conoce, escudos e iniciales, no son enlaces.

**Tarjetas compartidas por calendario y competiciones.** Muestran categoría,
fecha y hora de Madrid, nombre de cada equipo y escudo (o iniciales).
Solo enlazan al detalle si hay dos puntuaciones; sin marcador completo, destacan
el pabellón si se conoce. El recuadro de fecha, hora y pabellón abre Google Maps
en una pestaña nueva si `venues.json` contiene una URL HTTP(S) válida en `maps`.
El nombre del pabellón se muestra como texto, sin subrayado propio.
Un borde rojo identifica los partidos de `BALONCESTO ALCOBENDAS`, también en la
tira superior.

## Detalle · `/#/game/:slug`

La página carga el partido bajo demanda y distingue entre carga, partido inexistente
y error. Muestra los equipos, resalta el tanteo ganador y desglosa cuartos y
prórrogas. Omite la hora o el pabellón si se desconocen. Si `venue.maps` es una
URL HTTP(S) válida, el nombre del pabellón enlaza al mapa.

Si hay vídeo, aparece entre los parciales y las pestañas. Los vídeos de YouTube
usan `youtube-nocookie.com`, sin reproducción automática y respetando el tiempo
de inicio. Otras URL HTTP(S) se muestran como enlace.

| Pestaña                     | Contenido                                                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estadísticas de cada equipo | Una tabla por equipo, ordenada por dorsal, con minutos, puntos, valoración y +/−; la fila final suma puntos y valoración. Si faltan estadísticas, se indica.                                                                      |
| Evolución del marcador      | Gráfica de puntos acumulados por minuto, incluidas las prórrogas: local en rojo, visitante en azul. Al consultar una canasta se ven tiempo, equipo, tanteo y dorsal. Si solo hay datos de un equipo, se muestran los disponibles. |
| Jugada a jugada             | _Ver apartado_                                                                                                                                                                                                                    |

Las pestañas no cambian la URL. Para volver a la lista se usa «Atrás» del navegador.
También quedan pendientes el filtro por categoría y más columnas de estadísticas.

### Pestaña Jugada a jugada

La pestaña muestra las jugadas en tarjetas, en el orden del JSON (la más
reciente primero). Cada tarjeta tiene tres bloques: local (40 %), centro y
visitante (40 %).

- **Canastas.** En los tiros libres, las canastas de dos y los triples, el
  marcador aparece en el centro con borde. El periodo, el tiempo restante,
  el tipo y el dorsal van en el bloque del equipo que anota, en orden simétrico.
  Si no hay canastas, se indica.
- **Tiros fallados.** «Tiro libre fallado», «Canasta de 2 fallada» y «Triple
  fallado» aparecen en el lado de quien tira, con dorsal y ❌ en lugar del
  marcador.
- **Faltas.** Se muestran las cometidas (personal, técnica, antideportiva,
  descalificante, técnica al entrenador o al banquillo, disruptiva y flagrante)
  en el lado de quien las comete, con ✋ en lugar del marcador. Las técnicas
  al entrenador y al banquillo no muestran dorsal. Las faltas recibidas no
  se muestran.
- **Rebotes y asistencias.** «Rebote defensivo», «Rebote ofensivo» y «Asistencia»
  aparecen en el lado del equipo que realiza la jugada, con dorsal y 🙌 o 🤝
  en el centro, respectivamente. En el JSON, la asistencia va justo encima
  de su canasta.
- **Tapones.** Una sola tarjeta con ⛔ en el centro muestra «Tapón puesto» en
  un lado y «Tapón recibido» en el otro, cada uno con su dorsal. En el JSON,
  el recibido va justo antes del puesto; si alguno va suelto, aparece solo en
  su lado.
- **Robos y pérdidas.** Funcionan como los tapones: una tarjeta con 🥷 en el
  centro muestra «Robo» en el lado del equipo que roba y «Pérdida» en el otro,
  cada uno con su dorsal. En el JSON, el robo va justo antes de la pérdida. Las
  pérdidas sin robo aparecen solas en su lado.
- **Tiempos muertos.** Aparecen en el lado del equipo que los pide, con ⏱️ en
  el centro y sin dorsal.
- **Cambios y quintetos.** Los cambios de un equipo en el mismo instante se
  agrupan en una tarjeta con 🔄 en el centro («Entra #9 · Sale #6»). Las
  entradas sin salidas al empezar un periodo forman el quinteto
  («Quinteto: #4 #6 …»).

El inicio y el fin de cada periodo aparecen entre las tarjetas como líneas
de separación con el texto centrado («Inicio de cuarto Q1»,
«Fin de prórroga OT1»). Las marcas idénticas consecutivas se muestran una sola vez.
