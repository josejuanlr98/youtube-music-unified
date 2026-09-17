# YouTube Music Unified 0.5.3

## Correcciones

- Búsqueda: seleccionar una canción reproduce su videoId con yt-dlp directamente,
  usando los metadatos del resultado. Ya no depende de crear una radio ni de
  get_song. Si falla la extracción, conserva la cola anterior.
- Radio: se conserva como operación separada; su alternativa interpreta
  correctamente videoDetails de get_song.
- Letras: acepta el identificador de letras como texto (formato de ytmusicapi
  1.11.5 incluido) y como objeto con browseId. Lo obtiene del watch playlist y
  después llama a get_lyrics. Si faltan letras, muestra “Lyrics not available”.
- Se parchea py_modules/ytmusicapi/parsers/watch.py para tolerar pestañas
  opcionales sin endpoint, pestañas ausentes y navigationEndpoint. El parche
  también evita que la ausencia de la pestaña Related rompa las letras.
- Unlink: termina la sesión Cast, restablece el estado del receptor y vuelve
  a anunciarlo si la red actual sigue siendo de confianza. Las operaciones se
  serializan con los cambios de red. Si falla el reinicio, el sondeo lo reintenta.
- La interfaz informa de un fallo de Unlink en lugar de anunciar éxito siempre.

## Instalación

1. Copia youtube-music-unified-0.5.3.zip a la Steam Deck.
2. Instálalo desde las opciones de desarrollador de Decky: Install from ZIP.
3. Reinicia Decky o la Steam Deck si todavía aparece la interfaz anterior.
4. Conserva la red de casa marcada como confiable en los ajustes del plugin.

El ZIP instalable contiene la carpeta “YouTube Music”, con el mismo nombre de
plugin de la versión anterior. No contiene credenciales ni borra los ajustes.
El archivo terminado en -source.zip contiene el código, pruebas, dependencias
Python y binarios Linux; no incluye node_modules. Ejecuta pnpm install para
reconstruir. Los binarios Linux node y yt-dlp se conservan del ZIP 0.5.2 recibido.

## Verificación

- 10 pruebas Python aprobadas: búsqueda/reproducción directa, errores de stream,
  radio y formatos/ausencia de letras, incluido el parser real de ytmusicapi.
- 4 pruebas Node aprobadas cargando el código real de server.ts con servicios
  simulados: reinicio tras Unlink, red no confiable, recuperación tras fallo y
  dos solicitudes simultáneas.
- Frontend compilado con Rollup y backend con esbuild.
- Comprobación TypeScript de frontend y backend de producción aprobada
  (skipLibCheck para declaraciones de dependencias).
- La suite Vitest completa no se ejecutó: el entorno local impide crear sus
  subprocesos (spawn EPERM). Se incluye también la regresión de Unlink en Vitest.
- Sin acceso físico a la Steam Deck ni a una cuenta de YouTube: la reproducción
  real, las letras ofrecidas por YouTube y el descubrimiento SSDP deben verificarse
  en el dispositivo. Las pruebas automatizadas simulan las respuestas externas.

Comandos de regresión ejecutados desde el código fuente:

```text
python -m unittest discover -s tests -v
node tests/test_cast_lifecycle.cjs
```

Prueba en la Deck: busca y reproduce una canción; abre Lyrics; conecta el teléfono
por Cast, pulsa Unlink y comprueba que la Deck vuelva a aparecer y permita conectar.
Si YouTube no tiene letras de esa canción, debe aparecer “Lyrics not available”.

Referencia del contrato de letras:
https://ytmusicapi.readthedocs.io/en/stable/reference/browsing.html

El enlace al chat compartido no pudo recuperarse. Las correcciones se basan en el
ZIP 0.5.2 y los problemas descritos por el usuario.
