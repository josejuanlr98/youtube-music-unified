# YouTube Music Unified 0.5.9

Última pulida de la interfaz del panel Quick Access.

## Cambios

- Los estados superiores del reproductor (`Your music, on Deck`, `Now
  playing`, `Cast connected` y `From ...`) ahora quedan centrados.
- La carátula aumentó ligeramente de tamaño y tiene una separación más clara
  respecto al estado y los metadatos.
- El contenedor de las pestañas dejó de usar una altura fija. Ahora calcula su
  altura con el viewport disponible, hasta 620px, para evitar cortes al usar
  Steam Deck en una pantalla externa o con otra escala.
- Se mantiene el ajuste compacto para paneles muy estrechos, sin animaciones ni
  procesos adicionales en segundo plano.

## Instalación

1. Copia `youtube-music-unified-0.5.9.zip` a la Steam Deck.
2. En Decky abre Developer Options → Install from ZIP.
3. Instálalo sobre el plugin YouTube Music y reinicia Decky si la versión
   anterior todavía aparece en pantalla.

El archivo `youtube-music-unified-0.5.9-source.zip` es solo para desarrollo.

## Verificación

- TypeScript, Rollup y esbuild: aprobados.
- 19 pruebas Vitest, 10 pruebas Python y 11 comprobaciones Node: aprobadas.
- La vista utiliza el ancho completo disponible y una altura responsive.

La validación final con el mando físico debe hacerse en Quick Access de la
Steam Deck y con la resolución externa que se vaya a utilizar.
