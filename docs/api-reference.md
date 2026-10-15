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

#### Otras consideraciones

- Parece que no se puede filtrar por `Categoria`: no se reduce ni filtra el número de resultados

## Buscar equipo: `/v2/busqueda.ashx`

## Marcador de un partido en vivo: `/v2/envivo/partido.ashx`

Marcador, parciales por cuarto(`partido.periodos`) y jugadas (`envivo.historialacciones`)

```bash
curl -s https://data.source/v2/envivo/partido.ashx \
-d id_partido={id-partido} \
-d id_dispositivo={id-dispositivo-guardado} \
-d key={key-guardada}
```

Respuesta:

```json
{
    "resultado": "correcto",
    "partido": {
        "tipo_acta": "ESTADÍSTICAS",
        "estado_partido": "FINALIZADO",
        "idclublocal": "53006C0033006F00430038007900560037004A005500610072006F00770064004600680042006D006E0042007A003600390076004B004D0038006C0032007000420073003300520074006A002F006F006600390069007A00550079003900550070005000550054003900490031004A0074006D00500032005300380051006D0063004B004B00540077006E0038002F006C00780066006600530030006F006500350046004D006E006F0050006700620035003400610052005000660057004200750058004D002F004500680075002B00620047004C004300310057005500720031007800470064006F0073003800550068006A00310038003400760051004B004700760035006A006C00640042003500410076003000610052006D007A0073007A006A00320030007A0077004500510039007400540065003600710054004900670049005500580067004300520030004C0053005400320078004F006600540031004E004A00430032006B002F004300390075003800390041004F0061006B00",
        "idlocal": 836007,
        "local": "JANSEN BT 'A'",
        "color_local": "NEGRO",
        "idclubvisitante": "53006C0033006F00430038007900560037004A005500610072006F00770064004600680042006D006E0045006A00650056002F00370078002B0030006B004F00380049004A00740077006A0034004200780064004B006B006E005900360078004100780056002F00370038004E006300710037007700750030006B006E006D00360079006E00300034006E00720053006F004D004A00330057007100560077004900760049003200650076002F0036005A002F006F006F0057003500300044007200360067006E00790050004B004F0031003300540046003000590039005200520034006D00790064004E003300540056006B004900750032004E006A005800480051006F007200440056007A00500076007A005500530071004900450068003400380062005A0048007500370049006A006B007A00480056005100480079004C002B003600560046006E00520032004C006C0054004D0051004F004900570061005300300057005200460066004500750074006A006E005A005A0061004C00",
        "idvisitante": 836785,
        "visitante": "FUNDAL ALCOBENDAS 'A'",
        "color_visitante": "ROJO",
        "tanteo_local": 88,
        "tanteo_visitante": 81,
        "campoTipo": "FIBA",
        "numperiodos": 4,
        "numperiodos_total": 4,
        "tiene_porrogas": false,
        "duracion_periodo_normal_mm": 10,
        "duracion_periodo_extra_mm": 5,
        "tiempo_total_partido": 2400,
        "duracion_partido_mm": 40,
        "periodos": [
            {
                "periodo": 1,
                "tanteo_periodo_local": 21,
                "tanteo_periodo_visitante": 19
            },
            {...}
        ],
        "fechaultimaactualizacion": "/Date(1792054767564)/",
        "identificador_servidor": "..",
        "competicionCategoriaConPDFEstadisticas": false,
        "IdClubLocalEncriptado": "76006D004E00550069007000720079003400790069004D0078004A00440034004F005600370035006D0067003D003D00",
        "IdClubVisitanteEncriptado": "76007600620055006B006B0055003000780074005700300032004200420067003100630032007A00680041003D003D00"
    },
    "envivo": {
        "jugadoresenpistalocal": [
            {
                "idequipo": 836007,
                "id": "35007A00520071006A00480077004600670069002F004F006600740056004D00620032005000790065005500720074004900750044003100340068006C0072004C003300310049006600490039006A0045004100490047004500590075004B0070006800540044004C004A0053004E003700660031006E00370041004F0031006A006600790036005500570045006E004D00660077006A005100390079007300310053004E0046004F00480077004B004900560065006B006B006B00420044002F00620036003800730032003600740058004900760044005300420038005100340059003000540034002F0033004E004D0036006B00530055003200730044002F0050004D0030004F0037003600630052004B0059007400340063006800530052007200510034006A00410037004E0073006400320068004700630066004C00690078004900360062004800440074004D00580063003D00",
                "nombre": "OJEDA HRVATSKO, SIMÓN VALENTÍN",
                "dorsal": "3",
                "minutos": "28:56",
                "puntos": 24,
                "rebotes": 7,
                "asistencias": 3,
                "faltas": 2,
                "valoracion": 31,
                "masMenos": 16
            }
        ],
        "jugadoresenpistavisitante": [],
        "historialacciones": [
            {
                "autoincremental_id": 682,
                "padre_id": "",
                "eliminado": "False",
                "publicado": "False",
                "numero_periodo": 4,
                "tiempo_partido": "00:02:47.0",
                "hora_dia": "21:05:51",
                "accion_tipo": "TIRO2-FALLADO",
                "componente_id": "619393",
                "equipo_id": 836785,
                "dorsal": "47",
                "posicion_x": "85",
                "posicion_y": "200",
                "zona": "Z2-DE",
                "peso": 0,
                "puntos_local": 0,
                "puntos_visitante": 0,
                "informacion_adicional": ""
            }
       ],
        "fechaultimaactualizacion": "/Date(1792054767545)/"
    },
    "error": "",
    "EnVivoJugadoresOTT": {
        "JugadoresEnVivoLocal": [],
        "JugadoresEnVivoVisitante": [],
        "OTT": false,
        "UrlOTT": "https://fbmtv.fbm.es/es/partido-375985/jansen-bt-27a27-vs-fundal-alcobendas-27a27"
    }
}
```
