# ¿Cómo se cosechan los datos?

## Qué información se pierde

- Se pierden partidos del histórico

El buscador va soltando la temporada anterior (de 73 partidos de la 25/26, en 
septiembre solo seguían saliendo 34) y la lista de partidos seguidos solo mira
hacia delante

Un partido que tu servidor no guardó mientras estaba disponible ya no se puede
recuperar

- Se pierden actas

El acta se pide con un `id_partido` que la fuente vuelve a cifrar en cada
búsqueda y que caduca

Si nadie la descarga después del partido, luego puede no haber forma de pedirla

- Arranque en frío lento

Rehacer el barrido del buscador son unas 18 páginas a ~3 s cada una

Al encender, pasa casi un minuto antes de poder acceder a los próximos partidos

- Cadena de keys rota

Si se apaga justo después de recibir una key nueva y antes de guardarla, la 
guardada en disco queda obsoleta. 

Al volver, todo contesta «Faltan parámetros» hasta que el proxy
se da de alta otra vez (hazlo automático)

## Comunicación con la fuente

Todo va a un solo host, https://data.source, por POST con cuerpo
`application/x-www-form-urlencoded`, incluso para leer.

Responde JSON; un `error` vacío significa que ha ido bien.

Revisa los endpoints que expone el API en [REST API reference](api-reference.md).

La **`key` va rotando** en cada respuesta.

- Cada llamada lleva `id_dispositivo` y `key` en el cuerpo, además de sus propios
parámetros.
- Cada respuesta trae una `key` nueva. Hay que guardarla y usarla en la siguiente
llamada.
- Si te saltas una, la cadena se rompe y todo empieza a contestar `{"error":"Faltan
parámetros"}`. No da un error de autenticación: parece que la llamada está mal hecha.
- Un solo cliente por `key`. Dos llamadas a la vez se pisan la `key` y hay que
volver a empezar.
- Si la cadena se rompe, hay que volver a empezar, hay que volver a registrarse
(con el mismo uid o uno nuevo) y seguir.
