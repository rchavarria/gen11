# Flujo de sincronización

`npm run sync` ejecuta [src/sync.js](../src/sync.js). La descarga incluye tanto
partidos asignados a una jornada como pendientes; solo los asignados aparecen en la web.

```mermaid
flowchart TD
    config["Cargar config.json"] --> fetch["Consultar los próximos partidos"]
    fetch -->|Respuesta válida| save["Guardar la respuesta en next-games/"]
    fetch -->|Error de la API| retry["Renovar la clave y reintentar una vez"]
    retry -->|Respuesta válida| save
    retry -->|Fallo| report["Escribir el informe del día"]

    save --> merge["Comparar por IdPartido con los árboles de competición"]
    merge -->|Conocido| update["Actualizar fecha, hora y pabellón si procede"]
    merge -->|Nuevo con fecha y competición válidas| pending["Añadir a pending-games"]
    merge -->|Nuevo sin fecha válida o sin competición| skip["Omitir y anotar el motivo"]

    update --> download["Revisar las descargas de todos los partidos del árbol"]
    pending --> download
    skip --> download
    download --> scores["Obtener estadísticas y marcadores que correspondan; guardar los árboles"]
    scores --> calendar["Generar calendar.json con los partidos asignados"]
    calendar --> details["Generar el detalle de los que tienen ambos marcadores"]
    details --> report
    report -.->|Si quedan pendientes| manual["Asignarlos a su jornada a mano y ejecutar npm run build-data"]
```

**Descargas.** Se omiten los partidos marcados como descargados y se espera a que
pasen más de tres horas desde el inicio previsto. Si ya existen estadísticas y
marcador, se reutilizan; si solo existe uno, la ejecución se detiene. Si la API
responde «sin datos», se continúa con el siguiente partido.

**Informe.** Si falla la configuración, el proceso termina sin informe. Ante un
fallo posterior que interrumpa la ejecución, se intenta guardar el progreso y el
error en `<outputDir>/sync-reports/<YYYY-MM-DD>.md`. Cada ejecución reemplaza el
informe anterior del mismo día.
