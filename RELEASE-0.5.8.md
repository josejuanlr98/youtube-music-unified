# YouTube Music Unified 0.5.8

Últimos ajustes de interfaz para el panel Quick Access de Steam Deck.

## Cambios

- Lyrics ya no muestra botones `Page up`/`Page down` que podían añadir las
  etiquetas `Up`/`Down` al mover el foco. El desplazamiento continúa disponible
  con la cruceta y L1/R1; la ayuda `L1 / R1 · Page` queda centrada.
- El texto de Cast ahora dice `Shuffle / repeat: use your device.` y queda
  centrado para cubrir teléfonos, tabletas, ordenadores y otros dispositivos.
- El estado de Cast y el mensaje inicial tienen una separación equilibrada de
  la carátula.
- El icono del plugin usa `SiYoutubemusic`, incluido en `react-icons`, para
  mostrar la marca de YouTube Music en Quick Access.
- Se conserva la hoja de estilos global que evita que CSS aparezca como texto,
  junto con sliders nativos, tabs L1/R1, Queue estable, Lyrics y Stop/Clear/Unlink.

## Instalación

1. Copia `youtube-music-unified-0.5.8.zip` a la Steam Deck.
2. En Decky abre Developer Options → Install from ZIP.
3. Instálalo sobre el plugin YouTube Music y reinicia Decky si la versión
   anterior todavía aparece en pantalla.

El archivo `youtube-music-unified-0.5.8-source.zip` es solo para desarrollo.

## Verificación

- TypeScript, Rollup y esbuild: aprobados.
- 19 pruebas Vitest, 10 pruebas Python y 11 comprobaciones Node: aprobadas.
- Vista previa renderizada con el panel compacto.

La validación final con el mando físico debe hacerse en Quick Access de la
Steam Deck.
