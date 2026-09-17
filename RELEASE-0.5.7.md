# YouTube Music Unified 0.5.7

Esta versión recupera los controles de mando del reproductor y termina los
últimos detalles del panel Quick Access.

## Cambios

- Las barras de progreso y volumen usan de nuevo `SliderField` de Decky. La
  cruceta izquierda/derecha y el foco del mando modifican ambas barras, igual
  que en los repositorios originales.
- Las tabs Player, Queue y Library vuelven a usar `Tabs` de Decky, incluyendo
  el cambio con L1/R1.
- Se mantiene el ancho compacto sin mínimos de 270 px ni cambios en el layout
  de los contenedores de Steam.
- El acento visual pasa de rosa a rojo YouTube Music, con foco azul estilo
  Steam Deck y fondos azul grisáceos oscuros.
- Las filas de Queue quedan fijadas a 60 px para que eliminar una pista no
  provoque una expansión momentánea.
- Las reglas visuales se inyectan en la hoja global del plugin y ya no aparecen
  como texto dentro del panel de Decky.
- El estado de Cast y el mensaje inicial quedan ligeramente más cerca de la
  carátula para aprovechar mejor el espacio.
- Lyrics deja únicamente la ayuda `L1 / R1 · Page`; el regreso con B/Back queda
  implícito y no ocupa una línea adicional.
- Lyrics, `yt-music-headers.txt`, Stop/Clear/Unlink y las correcciones de la
  versión 0.5.6 se conservan.

## Instalación

1. Copia `youtube-music-unified-0.5.7.zip` a la Steam Deck.
2. En Decky abre Developer Options → Install from ZIP.
3. Instálalo sobre el plugin YouTube Music y reinicia Decky si la versión
   anterior todavía aparece en pantalla.

El archivo `youtube-music-unified-0.5.7-source.zip` es solo para desarrollo.

## Verificación

- TypeScript de frontend: aprobado.
- Rollup y esbuild: aprobados.
- 19 pruebas Vitest, 10 pruebas Python y 11 comprobaciones Node: aprobadas.
- Vista previa renderizada con controles de slider y panel compacto.

La validación final con el mando físico debe hacerse en Quick Access de la
Steam Deck, especialmente cruceta, L1/R1 y el botón ✕ de Queue.
