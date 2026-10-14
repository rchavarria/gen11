# REST API reference

Todas las llamadas son `POST https://data.source/{ruta}`, y todas (menos registrarse) llevan
`id_dispositivo` y `key`, además de los parámetros específicos.

Cada una tarda unos 3 segundos. Recuerda dar tiempo a la fuente entre peticiones, y no hacerlas en paralelo.

## Registrarse

Hay que presentarse como un dispositivo Android nuevo.

El `uid` es un Android ID inventado: 16 caracteres hexadecimales al azar.
Se puede generar con `openssl rand -hex 8`.

Usar el mismo `uid` en todas las peticiones si se quiere mantener 
la sesión (equipos, partidos y jugadores a los que sigues),
o uno nuevo si se quiere empezar de cero.

```bash
curl -s https://data.source/dispositivo.ashx \
-d accion=registrar \
-d uid=$(openssl rand -hex 8) \
-d plataforma=android \
-d tipo_dispositivo=mobile \
-d version=5.0.35
```

Devuelve `resultado:"correcto"` con dos valores que hay que guardar:
`id_dispositivo` y `key`.

```json
{
    "resultado": "correcto",
    "id_dispositivo": "...",
    "key": "...",
    "ruta": "https://data.source",
    "error": "",
    "publicidad": "...",
    "perfil": {...},
    "email_verificado": false,
    "email": null,
    "ProximosPartidos": null,
    //...
}
```

## Llamadas útiles

Ir poniéndolas en H2 y describiendo qué hacen y qué parámetros llevan. Poner ejemplos de `curl` y de respuesta JSON.

- buscar partido
- buscar equipo
- buscar jugador
- listar/insertar/eliminar: seguir a mis equipos
- listar/insertar/eliminar: seguir a mis jugadores
- listad de próximos partidos
- plantilla del equipo
- partido en vivo: Marcador, parciales por cuarto(`partido.periodos`) y jugadas (`envivo.historialacciones`)
- estadísticas en vivo: el **acta**, lo que más interesa de un partido, con los jugadores y sus estadísticas
- imágenes de jugadores y equipos

## Buscar partido: `/v2/busqueda.ashx`

Buscar partidos por texto (nombre del club).

Va paginando los resultados de 50 en 50.

```bash
curl -s https://data.source/v2/busqueda.ashx \
-d accion=buscarPartido \
-d texto={Nombre del club} \
-d skip=150 \
-d id_dispositivo={id-dispositivo-guardado} \
-d key={key-guardada}
```

Respuesta:

```json
{
    "partidos": [
        {
            "IdPartido": "300070006700750046004E006E0031006400370045005400620075005A0038007500480057005100430077003D003D00",
            "IdPartidoNotificacion": "306273",
            "NombreEquipoLocal": "FUNDAL ALCOBENDAS",
            "NombreEquipoVisitante": "OLIMPICO 64",
            "Fecha": "09/09/2025",
            "Hora": "21:15:00",
            "Competicion": "COMPETICIONES FEDERADAS FBM",
            "Categoria": "Liga VIPS Femenina",
            "Estado": "Terminado",
            "NombreClubLocal": "BALONCESTO ALCOBENDAS",
            "NombreClubVisitante": "OLIMPICO 64",
            "Delegacion": "Federación de Baloncesto de Madrid",
            "EsFavorito": false,
            "FechaHora": "/Date(1757452500000)/",
            "FechaHoraUTC": "/Date(1757445300000)/",
            "NumeroJornada": -1,
            "FechaJornada": "/Date(-62135596800000)/",
            "Resultados": {
                "ResultadoLocal": "66",
                "ResultadoVisitante": "34",
                "ResultadosPeriodo": [
                    {
                        "Local": 15,
                        "Visitante": 7
                    }
                    //...
                ]
            },
            "TipoActa": "ESTADÍSTICAS"
        }
   ],
    "resultado": "correcto",
    "id_dispositivo": "",
    "key": "...",
    "error": "",
    "numeroMaximoResultados": 50
}
```

Campos que interesan de cada partido (tanto de buscar partido como listar próximos partidos):

- IdPartido
- IdPartidoNotificacion
- Fecha
- FechaHoraUTC
- Estado
- Categoria
- NombreEquipoLocal
- NombreEquipoVisitante
- Resultados.ResultadoLocal/ResultadoVisitante
- Estado vale:
  - No comenzado
  - Comenzado
  - Terminado

## Buscar equipo: `/v2/busqueda.ashx`

