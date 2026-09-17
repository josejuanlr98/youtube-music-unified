# YouTube Music Unified 0.5.4

## Cambios

- El archivo de autenticación sugerido se llama **yt-music-headers.txt** y la
  ruta predeterminada es **/home/deck/yt-music-headers.txt**. Las instrucciones
  dentro de Settings usan el nuevo nombre. Una sesión ya iniciada se conserva;
  solo necesitas renombrar tu archivo cuando vuelvas a cargar los headers.
- **Stop, Clear & Unlink** corta el audio inmediatamente, limpia la cola local y
  solicita terminar la sesión Cast incluso si la interfaz no detectó la conexión.
  La Deck vuelve a anunciarse en la red confiable, igual que con Unlink en 0.5.3.
  Si algo falla, el botón muestra el error y permite reintentar.
- Las cargas de audio Cast pendientes y las recuperaciones locales se invalidan
  al detener. Esto evita que una respuesta atrasada reactive la reproducción.
- **Lyrics** abre una vista contenida dentro del panel, con portada, artista y texto grande.
  La cruceta arriba/abajo desplaza el texto cuando está enfocado; **L1/R1** mueve
  una página. Hay barra visible y botones **Page up / Page down** para mando o
  touch. **B** y **Back** regresan al reproductor. El texto cambia con la canción.
- Reproductor más compacto, controles con mayor separación y foco visible,
  portada más grande y un botón principal destacado. La barra de posición usa
  el componente de Decky para permitir control con mando. Listas y ajustes
  comparten el tratamiento visual. Shuffle/repeat se controlan desde el teléfono
  durante Cast, por lo que sus botones locales aparecen desactivados.

## Recursos

No se agregaron procesos, intervalos de sondeo, animaciones continuas, fondos
desenfocados ni procesamiento de portadas. Las letras se consultan únicamente
al abrir su pantalla o cambiar de canción mientras está abierta. La caché guarda
como máximo seis letras y se vacía al descargar el plugin. Los listeners de la
pantalla se eliminan al cerrarla. Se eliminó además una llamada duplicada de
volumen por cada movimiento del slider: audio inmediato y persistencia con debounce.

No se midió CPU/RAM en una Steam Deck real; estas son propiedades del código.

## Instalar

1. Copia **youtube-music-unified-0.5.4.zip** a la Deck.
2. En Decky abre opciones de desarrollador → **Install from ZIP**.
3. Instálalo sobre YouTube Music. Reinicia Decky si todavía ves la interfaz anterior.
4. Mantén tu red marcada como confiable para poder recibir Cast.

No instales el archivo **-source.zip**: ese es el código fuente para desarrollar.
Se conserva la identidad del plugin, sus rutas de ajustes y los binarios Linux
que incluía la versión anterior.

## Validación

- 10 pruebas Python de búsqueda, reproducción y letras: aprobadas.
- 4 pruebas del ciclo de Cast: aprobadas.
- 7 comprobaciones nuevas: Stop inmediato, deduplicación, fallo/reintento,
  cancelación de carga Cast, cancelación del anuncio diferido de una pista,
  caché de letras limitada y eventos de navegación de letras: aprobadas.
- TypeScript de frontend y backend de producción, Rollup y esbuild: aprobados.
- Distribución inspeccionada en navegador con vistas generadas desde los
  componentes; los controles nativos de Decky se representaron con equivalentes.
- La suite Vitest completa sigue bloqueada por spawn EPERM en este entorno.
  Los ejecutores Node no necesitan subprocesos y cargan el código TypeScript real
  con dependencias externas simuladas.

Pendiente en hardware: confirmar el foco y desplazamiento con el mando real de
Steam, salida con B, detención desde una sesión Cast activa y nueva conexión
desde el teléfono. No se dispone de Steam Deck ni cuenta de YouTube aquí.

Pruebas desde el directorio del código fuente:

```text
npm test
npm run test:python
```
