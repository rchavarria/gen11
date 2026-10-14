## Cómo pedir los datos

Haz las peticiones una a una, nunca en paralelo

Espera un tiempo mínimo de ~3 o ~5 segundos entre peticiones

Cada respuesta tiene una `key`, que va cambiando con cada petición.
Guárdala para usarla en la siguiente petición. Si no la guardas, 
la siguiente petición fallará con un error de «Faltan parámetros»
(no muy descriptivo que digamos).

Un detalle de codificación: `id_dispositivo` y `key` llevan el carácter `=`.
Si los pasas por `URLSearchParams` o `qs.stringify`, se convierten en `%3D`
y la fuente no los reconoce.

Codifica tus parámetros normalmente y añade esos dos al final tal cual:

```JavaScript
const body = `${new URLSearchParams(params)}&id_dispositivo=${ID_DISP}&key=${KEY}`;
```
