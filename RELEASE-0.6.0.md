# YouTube Music Unified 0.6.0

## Instalar

Instala `youtube-music-unified-0.6.0.zip` desde las opciones de desarrollo de
Decky, sobre YouTube Music. El ZIP `-source` es para desarrollo.

## Cola

- Botón de flechas verticales: abre controles para subir o bajar la canción.
  La marca de verificación termina la edición. Las filas mantienen su altura.
- Botón Play next: coloca la pista después de la actual, sin interrumpirla.
- En reproducción local, Play next también ajusta el orden aleatorio. Si estaba
  activo Repeat One, lo desactiva para permitir el salto a la pista elegida.
- Las acciones comprueban que la cola siga siendo la misma para no mover otra
  canción si llegó una actualización mientras se navegaba.
- En Cast, el receptor respeta el orden editado al avanzar o retroceder, tanto
  con sus botones como al terminar la canción. Una nueva cola enviada por el
  dispositivo emisor vuelve a tomar prioridad. La app emisora puede seguir
  mostrando su orden original: su protocolo no ofrece una operación pública
  para escribir ese orden desde el receptor.
- Las colas Cast con IDs duplicados requieren ordenar desde el dispositivo
  emisor, porque el receptor identifica las pistas por su videoId.
- Eliminar pistas en Cast sigue siendo una función del dispositivo emisor;
  el botón se desactiva en lugar de aparentar que eliminó la canción.

## Notificaciones

En Settings → Notifications hay cuatro opciones persistentes:

1. Device connected: nombre del dispositivo que se conecta.
2. Connection sound: sonido de ese aviso.
3. Now playing: portada, título y artista al comenzar otra canción.
4. Song change sound: sonido de los cambios de canción.

Ambos avisos están activados por defecto y ambos sonidos desactivados.
Se utiliza el sistema nativo de notificaciones de Decky/Steam. Su aspecto y
visibilidad dependen de Steam y sus ajustes de notificaciones. Funcionan con
Quick Access cerrado, sin un nuevo proceso de sondeo. Pausa/reanudación y
mensajes repetidos de una misma pista no generan avisos duplicados.

## Validación

- TypeScript del frontend y backend, Rollup y esbuild: aprobados.
- 23 pruebas Vitest, 13 Python y las comprobaciones Node: aprobadas.
- Pruebas nuevas de reordenamiento, conservación de la canción actual,
  avance automático, cola aleatoria, rechazo de selecciones antiguas,
  persistencia de ajustes y notificaciones independientes sin duplicados.
- ZIP verificado y binarios Linux incluidos con permisos de ejecución.

Pendiente de prueba física: navegación con mando, aspecto de las notificaciones
en SteamOS y convivencia del orden Cast con cada app emisora.
