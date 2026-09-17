# Contribuir

Las mejoras y correcciones son bienvenidas. Antes de abrir un issue, comprueba el Release más reciente.

## Desarrollo

```powershell
pnpm install
pnpm run build
pnpm run build:backend
pnpm test
pnpm run test:python
```

Los cambios visuales deben validarse en Quick Access de una Steam Deck. Las dimensiones, el foco del mando y algunas clases de Steam no se pueden verificar por completo en un navegador de escritorio.

Nunca incluyas headers, cookies, tokens, oauth.json, capturas privadas ni datos de tu cuenta. El archivo yt-music-headers.txt es una credencial de sesión.

Describe en cada PR el comportamiento antes/después, la versión de SteamOS/Decky usada y las pruebas ejecutadas.

