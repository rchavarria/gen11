# Acciones de los partidos (`playByPlay`)

`build-data.js` convierte `envivo.historialacciones` (fichero de marcador de cada partido en
`games-scores/<id>.json`) en el campo `playByPlay` de `src/data/games/<slug>.json`. Este documento
se mantiene a mano; el mapeo está en `src/core/play-by-play.js` (`ACTION_TYPES`).
Cifras sobre los 67 partidos descargados a 2026-11-19 (43.563 acciones).

## Formato de salida

```json
{
  "id": 690,
  "quarter": 4,
  "clock": "00:01:12.0",
  "type": "two-point-made",
  "team": "home",
  "jersey": "7",
  "homeScore": 54,
  "awayScore": 48
}
```

| Salida                   | Fuente                                                     | Transformación                                                    |
| ------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `id`                     | `autoincremental_id`                                       | número                                                            |
| `quarter`                | `numero_periodo`                                           | número; 5 o más son prórrogas                                     |
| `clock`                  | `tiempo_partido`                                           | string original (`HH:MM:SS.d`): tiempo **restante** del periodo   |
| `type`                   | `accion_tipo`                                              | según la tabla siguiente                                          |
| `team`                   | `equipo_id`                                                | `"home"` / `"away"`; `null` si vale -1. Otro valor lanza un error |
| `jersey`                 | `dorsal`                                                   | string tal cual, sin normalizar                                   |
| `homeScore`, `awayScore` | `informacion_adicional` (`tanteoLocal`, `tanteoVisitante`) | solo en las canastas                                              |

El orden es el de la fuente, es decir, el más reciente primero.

## Tipos de acción

«Equipo»: `sí` si `equipo_id` es el de uno de los equipos; `no` si vale -1 (`team: null`).
«Info»: contenido de `informacion_adicional`.

| Fuente (`accion_tipo`)         | `type`                      | Significado                           |    Nº | Equipo | Info                                            |
| ------------------------------ | --------------------------- | ------------------------------------- | ----: | ------ | ----------------------------------------------- |
| `CANASTA-1P`                   | `free-throw-made`           | Tiro libre anotado                    | 1.890 | sí     | tanteo                                          |
| `CANASTA-2P`                   | `two-point-made`            | Canasta de 2 anotada                  | 3.228 | sí     | tanteo                                          |
| `CANASTA-3P`                   | `three-point-made`          | Triple anotado                        |   891 | sí     | tanteo                                          |
| `TIRO1-FALLADO`                | `free-throw-missed`         | Tiro libre fallado                    | 1.343 | sí     | vacía                                           |
| `TIRO2-FALLADO`                | `two-point-missed`          | Tiro de 2 fallado                     | 2.987 | sí     | vacía                                           |
| `TIRO3-FALLADO`                | `three-point-missed`        | Triple fallado                        | 2.380 | sí     | vacía                                           |
| `1-TIRO-LIBRE`                 | `one-free-throw-awarded`    | Se concede 1 tiro libre               |   372 | sí     | vacía                                           |
| `2-TIROS-LIBRES`               | `two-free-throws-awarded`   | Se conceden 2 tiros libres            | 1.381 | sí     | vacía                                           |
| `3-TIROS-LIBRES`               | `three-free-throws-awarded` | Se conceden 3 tiros libres            |    33 | sí     | vacía                                           |
| `REBOTE-DEFENSIVO`             | `defensive-rebound`         | Rebote defensivo                      | 3.620 | sí     | vacía                                           |
| `REBOTE-OFENSIVO`              | `offensive-rebound`         | Rebote ofensivo                       | 1.898 | sí     | vacía                                           |
| `ASISTENCIA`                   | `assist`                    | Asistencia                            | 1.616 | sí     | vacía                                           |
| `PERDIDA`                      | `turnover`                  | Pérdida de balón                      | 2.823 | sí     | vacía                                           |
| `RECUPERACION`                 | `steal`                     | Robo de balón                         | 1.724 | sí     | vacía                                           |
| `TAPON-COMETIDO`               | `block-made`                | Tapón realizado                       |   372 | sí     | vacía                                           |
| `TAPON-RECIBIDO`               | `block-received`            | Tapón recibido                        |   369 | sí     | vacía                                           |
| `FALTA-COMETIDA`               | `foul-committed`            | Falta cometida                        | 2.767 | sí     | `JugadorEnPista`, `TLAsociados` (a veces vacía) |
| `FALTA-RECIBIDA`               | `foul-received`             | Falta recibida                        | 2.738 | sí     | `JugadorEnPista`, `TLAsociados` (a veces vacía) |
| `TECNICA`                      | `technical-foul`            | Técnica a un jugador                  |    10 | sí     | `JugadorEnPista`, `TLAsociados`                 |
| `TANTIDEPORTIVA`               | `unsportsmanlike-foul`      | Antideportiva                         |     9 | sí     | `JugadorEnPista`, `TLAsociados`                 |
| `TDESCALIFICANTE`              | `disqualifying-foul`        | Descalificante                        |     1 | sí     | `JugadorEnPista`, `TLAsociados`                 |
| `TBANQUILLO-B`                 | `bench-technical-foul`      | Técnica al banquillo                  |     6 | sí     | `JugadorEnPista`, `TLAsociados`                 |
| `TBANQUILLO-C`                 | `coach-technical-foul`      | Técnica al entrenador                 |    17 | sí     | `JugadorEnPista`, `TLAsociados`                 |
| `CAMBIO-JUGADOR-ENTRA`         | `substitution-in`           | Un jugador entra                      | 6.373 | sí     | vacía                                           |
| `CAMBIO-JUGADOR-SALE`          | `substitution-out`          | Un jugador sale                       | 3.643 | sí     | vacía                                           |
| `TIEMPO-MUERTO-SOLICITADO`     | `timeout`                   | Tiempo muerto                         |   344 | sí     | vacía                                           |
| `FLECHA-ALTERNANCIA-LOCAL`     | `possession-arrow`          | Flecha de posesión alterna: local     |    22 | sí     | vacía                                           |
| `FLECHA-ALTERNANCIA-VISITANTE` | `possession-arrow`          | Flecha de posesión alterna: visitante |    22 | sí     | vacía                                           |
| `INICIO-PARTIDO`               | `game-start`                | Inicio del partido                    |    67 | no     | vacía                                           |
| `FINAL-PARTIDO`                | `game-end`                  | Final del partido                     |    69 | no     | vacía                                           |
| `INICIO-PERIODO`               | `period-start`              | Inicio de un periodo                  |   273 | no     | vacía                                           |
| `FINAL-PERIODO`                | `period-end`                | Final de un periodo                   |   275 | no     | vacía                                           |

Las dos flechas comparten `type`; el lado lo indica `team`.
`JugadorEnPista` y `TLAsociados` no se guardan.

## Peculiaridades de los datos

- `dorsal` puede ser un número (`"0"` ≠ `"00"`), `"X"`, `"-1"` (acciones sin jugador),
  `"ENTRENADOR/A"` o `"ENT. AYUDANTE"`.
- `autoincremental_id` es único dentro de un partido, pero no siempre decrece al recorrer el array:
  hay acciones insertadas o corregidas después. El orden lo da el array.
- Puede haber prórrogas (`quarter` 5 o más).
- Dos partidos tienen dos `FINAL-PARTIDO`, y hay más `FINAL-PERIODO` que `INICIO-PERIODO`
  (por eso las cifras de arriba no coinciden entre sí). Se conservan tal cual.

## Campos de la fuente que no se guardan

`eliminado`, `publicado` (siempre `"False"`), `padre_id` (siempre vacío), `peso` (siempre `0`),
`componente_id`, `hora_dia`, `zona`, `posicion_x`, `posicion_y` (solo en tiros) y
`puntos_local`/`puntos_visitante` (no son el tanteo; vale el de `informacion_adicional`).

## Si aparece un tipo nuevo

`build-data` avisa con `Cannot build play-by-play for <slug>: accion_tipo desconocido: ...` y deja
`playByPlay: []` en ese partido. Hay que añadir el tipo a `ACTION_TYPES` en
`src/core/play-by-play.js` y a la tabla de este documento.
