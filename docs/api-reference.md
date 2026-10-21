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
- listado de próximos partidos
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

## Estadísticas de un partido en vivo: `/v2/envivo/estadisticas.ashx`

El **acta**, lo que más interesa de un partido, con los jugadores y sus estadísticas

```bash
curl -s https://data.source/v2/envivo/estadisticas.ashx \
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
            }
        ],
        "fechaultimaactualizacion": "/Date(1792059172909)/",
        "identificador_servidor": "..",
        "competicionCategoriaConPDFEstadisticas": false,
        "IdClubLocalEncriptado": "76006D004E00550069007000720079003400790069004D0078004A00440034004F005600370035006D0067003D003D00",
        "IdClubVisitanteEncriptado": "76007600620055006B006B0055003000780074005700300032004200420067003100630032007A00680041003D003D00"
    },
    "estadisticas": {
        "equipolocal": "JANSEN BT 'A'",
        "entrenadorlocal": "NAVAS LÓPEZ, ANGEL",
        "estadisticasequipolocal": [
            {
                "idequipo": 836007,
                "equipo": "JANSEN BT 'A'",
                "componente_id": "6E00710037006C004100670059006100540052007A00440059003600620049003200480059006A006D0078004D002F006B005800550050004A0053004A007500710066004800500041005400460057006A0059004B004D006200520065005A00380039005500470075005800420032006F00380061006F00330069005A004D006C005500460078007700420033006F00740055007000420036004B0078004E0031006A0064006C006E005900310057004A0039003700470033005300690055006E005100340072005600470078007700380068003300300053006D006500340038004D0055007200410036005200370079006D0068006C00340039006100570051006D002F00730047004C005500490044004C0053007200750044004A0030006500710058004300670068003200310030004D00690079006E0030004C006A004300640052004E0030004800550047005600490030003D00",
                "nombre": "NOMBRE",
                "dorsal": "X",
                "capitan": true,
                "quintetotitular": false,
                "puntos": 0,
                "tiro1p": 0,
                "tiro2p": 2,
                "tiro3p": 1,
                "canasta1p": 0,
                "canasta2p": 0,
                "canasta3p": 0,
                "tiro1Fallado": 0,
                "tiro2Fallado": 2,
                "tiro3Fallado": 1,
                "porcentaje1p": 0,
                "porcentaje2p": 0,
                "porcentaje3p": 0,
                "rebotedefensivo": 2,
                "reboteofensivo": 0,
                "rebotes": 2,
                "asistencias": 3,
                "perdidas": 1,
                "recuperaciones": 0,
                "taponescometidos": 0,
                "taponesrecibidos": 0,
                "faltascometidas": 4,
                "faltasrecibidas": 0,
                "valoracion": -3,
                "masMenos": 5,
                "milisegundos_jugados": 536811,
                "tiempo_jugado": "08:56"
            }
        ],
        "equipovisitante": "FUNDAL ALCOBENDAS 'A'",
        "entrenadorvisitante": "CAMPOS MARCOS, DANIEL",
        "estadisticasequipovisitante": [
            {
                "idequipo": 836785,
                "equipo": "FUNDAL ALCOBENDAS 'A'",
                "componente_id": "42004B0058005500740053007700430039004B0038002B00660066007200520064007A0067006400690064004900380071003800740031004400730046004C0045007300550061006D004D00680048006A00730057004F007200770070006E006C00490062004C006C006600310035006700630072004F006F0076004D006B002B00470042006F003900680035006700310032004B00430078006A006E004E0064006700710069006B0044006800430065007300470076006F0042007400340050004B006A00750074004E00430047002B00700070006B00300048005400660061006D0064005300300075006C002B007000720035005800500030004700340039004E00310035006C00510045006F007000410065004800620046002B004F00740035006A0035006A0031007700430038003900490056007900730053005000490051002F0069006F0044002F0046006400310030003D00",
                "nombre": "LÓPEZ SALESA, JAIME",
                "dorsal": "4",
                "capitan": false,
                "quintetotitular": false,
                "puntos": 0,
                "tiro1p": 0,
                "tiro2p": 0,
                "tiro3p": 2,
                "canasta1p": 0,
                "canasta2p": 0,
                "canasta3p": 0,
                "tiro1Fallado": 0,
                "tiro2Fallado": 0,
                "tiro3Fallado": 2,
                "porcentaje1p": 0,
                "porcentaje2p": 0,
                "porcentaje3p": 0,
                "rebotedefensivo": 0,
                "reboteofensivo": 1,
                "rebotes": 1,
                "asistencias": 0,
                "perdidas": 3,
                "recuperaciones": 1,
                "taponescometidos": 0,
                "taponesrecibidos": 0,
                "faltascometidas": 0,
                "faltasrecibidas": 0,
                "valoracion": -3,
                "masMenos": -6,
                "milisegundos_jugados": 500397,
                "tiempo_jugado": "08:20"
            }
        ],
        "fechaultimaactualizacion": "/Date(1792059172892)/",
        "Temporada": "26/27",
        "Categoria": "CadMasEspOro",
        "Delegacion": "FBM",
        "Competicion": "COMPETICIONES FEDERADAS FBM"
    },
    "error": ""
}
```

## Listado de próximos partidos: `/v2/mispartidos.ashx`

Todos los partidos de los equipos que sigues, en una sola llamada

```bash
curl -s https://data.source/v2/mispartidos.ashx \
-d accion=listadoProximos \
-d dias=365 \
-d id_dispositivo={id-dispositivo-guardado} \
-d key={key-guardada}
```

Respuesta:

```json
{
    "resultado": "correcto",
    "id_dispositivo": "",
    "key": "...",
    "mispartidos": [
        {
            "IdPartido": "710047004F004E004B00310047004B007000370035006400470068004E004800420057006A0054004A0041003D003D00",
            "IdPartidoNotificacion": "376009",
            "NombreEquipoLocal": "FUNDAL ALCOBENDAS \"A\"",
            "NombreEquipoVisitante": "ZENTRO BASKET MADRID",
            "ImgEquipoLocal": "53006C0033006F00430038007900560037004A005500610072006F00770064004600680042006D006E0045006A00650056002F00370078002B0030006B004F00380049004A00740077006A0034004200780064004B006B006E005900360078004100780056002F00370038004E006300710037007700750030006B006E006D00360079006E00300034006E00720053006F004D004A00330057007100560077004900760049003200650076002F0036005A002F006F006F0057003500300044007200360067006E00790050004B004F0031003300540046003000590039005200520034006D00790064004E003300540056006B004900750032004E006A005800480051006F007200440056007A00500076007A005500530071004900450068003400380062005A0048007500370049006A006B007A00480056005100480079004C002B003600560046006E00520032004C006C0054004D0051004F004900570061005300300057005200460066004500750074006A006E005A005A0061004C00",
            "ImgEquipoVisitante": "53006C0033006F00430038007900560037004A005500610072006F00770064004600680042006D006E004D00380078003300560064002F006B004D0074003100410054006D0041004F00370047006200420067002F006400680071006F0059004E004900660059007000370067006D00560042006E00360045006500750047002B006A0039004B007A0054007500520078005100740041007000520079004A00740042006100770035004A007900410052006800690055002B005A00640031004D0058006B0031004A00320036003100420033006D00560046005100710059005A0076004400440074006F004C00610059003900570038004E006800520050004D0030003100360067007700390039006E006300440053004500420049003600500065004F004E00790048006E004B00720034007800760069006600790071002F005900770054004F004E007700500053004800590033004E0036003400350054004A004F00310053005200670069004600730066006E0067006D0071006B00",
            "Fecha": "13/12/2026",
            "Hora": "13:15:00",
            "CampoJuego": "ANTELA PARADA, PABELLON (PISTA CENTRAL)",
            "DireccionCampo": "FRANCISCO CHICO MENDES, 8, Alcobendas, Madrid",
            "Longitud": "",
            "Latitud": "",
            "Competicion": "COMPETICIONES FEDERADAS FBM",
            "Categoria": "Cadete Masculino LIGA AHORRAMAS - ORO",
            "Estado": "No comenzado",
            "NombreClubLocal": "BALONCESTO ALCOBENDAS",
            "NombreClubVisitante": "ZENTRO C.B.",
            "Delegacion": "Federación de Baloncesto de Madrid",
            "EsFavorito": true,
            "FechaHora": "/Date(1797167700000)/",
            "FechaHoraUTC": "/Date(1797164100000)/",
            "NumeroJornada": -1,
            "FechaJornada": "/Date(-62135596800000)/",
            "Video": false,
            "Resultados": {
                "ResultadoLocal": "-",
                "ResultadoVisitante": "-",
                "ResultadosPeriodo": []
            },
            "OTT": false,
            "UrlOTT": "",
            "TipoActa": "ESTADÍSTICAS"
        }
    ],
    "Club": "",
    "error": ""
}
```
