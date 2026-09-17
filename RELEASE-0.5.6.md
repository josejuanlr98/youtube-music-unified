# YouTube Music Unified 0.5.6

Esta versión termina el ajuste visual para el panel Quick Access de Steam Deck.

## Cambios visuales

- Lyrics ya no navega a una ruta de pantalla completa. Se muestra dentro del
  panel del reproductor, sin cambiar el tamaño ni el overflow de los contenedores
  de Steam. Al volver, el reproductor conserva su geometría.
- La portada de Lyrics queda limitada a 78×78 px en el panel estrecho. El texto
  ocupa el espacio restante en una caja propia con scrollbar visible.
- El desplazamiento de letras usa `scrollBy({ behavior: 'smooth' })`, además de
  `scroll-behavior: smooth` en la caja. Cruceta arriba/abajo desplaza línea a
  línea, L1/R1 avanza una página y los botones Page up/Page down siguen disponibles.
- El reproductor usa un ancho de 100 %, `min-width: 0`, filas flexibles y altura
  fija de 390 px con contenido interno de 360 px. Las reglas CSS también anulan
  los mínimos de ancho que Decky aplica a sus botones, evitando el estiramiento
  que se veía en el panel.
- Se eliminó la etiqueta “Track position”/“Position”; quedan la barra y los
  tiempos para que el control sea más limpio.
- “From (device)” ahora aparece inmediatamente debajo de “Cast connected”.
- El botón de Lyrics conserva el foco y el contexto del reproductor. El botón B
  y Back regresan sin cerrar/reabrir Side Menus ni deformar la interfaz.

## Rendimiento

La vista interna evita una navegación de pantalla completa y no crea intervalos
adicionales. Lyrics se solicita solo al abrirla o cambiar de canción. La caché
se limita a seis canciones y se limpia al desmontar el plugin. No se usan blur,
animaciones continuas ni procesamiento extra de imágenes.

## Instalación

1. Copia `youtube-music-unified-0.5.6.zip` a la Steam Deck.
2. En Decky abre Developer Options → Install from ZIP.
3. Instálalo sobre el plugin YouTube Music y reinicia Decky si la versión previa
   todavía aparece en pantalla.

La ruta de autenticación continúa siendo `/home/deck/yt-music-headers.txt`.
El archivo `youtube-music-unified-0.5.6-source.zip` es solo para desarrollo.

## Verificación

- TypeScript de frontend y backend: aprobado.
- Rollup y esbuild: aprobados.
- 19 pruebas Vitest: aprobadas.
- 10 pruebas Python: aprobadas.
- 11 comprobaciones Node adicionales de audio, Cast, caché y navegación: aprobadas.
- Vistas previas renderizadas con el ancho del panel para comprobar que no hay
  desbordamiento horizontal y que la portada no ocupa toda la pantalla.

La validación final con el mando físico y Quick Access real debe hacerse en la
Steam Deck. En particular, confirma cruceta, L1/R1, B, Stop/Clear/Unlink y que
la red confiable vuelva a anunciar el receptor.
