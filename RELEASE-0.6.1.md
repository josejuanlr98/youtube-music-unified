# YouTube Music Unified 0.6.1

- Logo del aviso de conexión: icono de 40 px centrado en un área de 48 × 48 px.
  El mismo diseño se usa cuando una canción no tiene portada.
- Al abrir Lyrics se solicita el foco nativo de Steam para el lector de letras.
  La solicitud espera brevemente su registro y termina al conseguir el foco o
  salir del panel. No hay un ciclo permanente en segundo plano.
- Ayuda centrada: `L1 Up · R1 Down`. L1 sube y R1 baja por páginas; la cruceta
  conserva el desplazamiento corto. L2 no es el botón de bajar.

Instala `youtube-music-unified-0.6.1.zip` desde las opciones de desarrollo de
Decky, sobre la instalación existente. El ZIP `-source` es para desarrollo.

Validación: TypeScript, Rollup y pruebas Node aprobados, incluidas las pruebas
del foco nativo, registro tardío, cancelación al salir, controles de Lyrics y
preferencias de notificación. Falta confirmar el resultado visual y la entrada
con mando en la Steam Deck física.

Referencia técnica para el foco nativo:
[implementación de navegación de Decky Metadata](https://github.com/beallio/Decky-Metadata/blob/main/src/ContentPanel.tsx).
