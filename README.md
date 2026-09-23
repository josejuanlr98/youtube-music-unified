# YouTube Music Unified for Decky Loader

A Steam Deck plugin that plays YouTube Music from Quick Access and turns the Deck into a YouTube Cast receiver. It combines local playback, queue, library, lyrics, controller-friendly controls, notifications, and Cast discovery on trusted networks.

The current stable version is **0.6.7**. Most users should install the ZIP attached to the latest Release.

Fullscreen lyrics use an animated, cover-colored gradient with a darker text layer for readability. Cover colors are extracted through Decky's CORS-safe resource fetch, with a bounded local fallback for Steam's embedded browser.

## Features

- Play YouTube Music songs and playlists, with direct videoId search playback.
- Queue controls: previous, next, remove, reorder, and Play next. Search results also include a Play next action.
- Local playback and YouTube / YouTube Music Cast session receiving.
- Cast discovery restricted to networks marked as trusted.
- Configurable Cast receiver name.
- Fullscreen lyrics with cover-based colors and a softly animated album background. Press **X** from Player or the compact lyrics reader to open fullscreen, **B** to return, stick/D-pad **up/down** to scroll, **L1/R1** for previous/next track, and **A** to play/pause. Real line-synchronized lyrics highlight and follow the song when timestamps are available; otherwise fullscreen uses gentle automatic reading scroll.
- Gamepad-controlled progress and volume sliders.
- Like/dislike, shuffle, repeat, and playlist library.
- Native Decky notifications for device connections and song changes. Each notification and sound is configurable separately; sounds are disabled by default.
- Stop, Clear & Unlink stops audio, clears the queue, and ends the active Cast session.

## Screenshots

![Player](screenshots/player.jpeg)

![Fullscreen Cast lyrics](screenshots/player-cast.jpeg)

![Player controls](screenshots/player-options.jpeg)

![Queue](screenshots/queue.jpeg)

![Compact lyrics](screenshots/lyrics.jpeg)

## Quick installation

1. Download `youtube-music-unified-0.6.7.zip` from **Releases**.
2. In Gaming Mode, open Decky → Developer Options → **Install from ZIP**.
3. Select the ZIP and restart Decky if the previous version is still shown.
4. For Cast, enable your trusted network in **Settings → Cast Receiver**. To use the built-in library, also sign in through **Settings → Account**.

The `-source` ZIP is intended for development.

## Authentication

**Sign-in is optional for Cast.** Without imported headers, the plugin automatically uses **Cast only** mode. Player and Queue remain available, and Library shows an optional sign-in prompt. Use the Cast menu on another device on the same trusted network to start playback.

Signing in unlocks the built-in library, search, song ratings, and lyrics. Those account features are unavailable in Cast-only mode. This refers to signing in within the plugin; the sending app may have its own account requirements.

The plugin uses browser request headers from an active YouTube Music session. It never stores your Google password. The exported file contains session cookies, so keep it private and never commit it to GitHub.

### Step 1: Export the headers

1. On your PC, open a browser, go to `https://music.youtube.com`, and sign in.
2. Open Developer Tools with **F12**, then select the **Network** tab.
3. Click around YouTube Music (opening **Library** is a reliable way to generate the request).
4. Find a successful **POST** request to `/browse` with status **200**.
5. Copy the request headers:
   - **Firefox:** right-click the request → **Copy → Copy Request Headers**.
   - **Chrome/Edge:** open the request, find **Request Headers**, and copy the headers starting at `accept: */*`.
6. Paste the result into a plain-text file named exactly **`yt-music-headers.txt`**. Do not add Markdown formatting or remove the `cookie:` header.

### Step 2: Transfer the file to the Deck

Copy `yt-music-headers.txt` to `/home/deck/`. You can use a USB drive, file sharing, or SSH/SCP:

```bash
scp yt-music-headers.txt deck@steamdeck:/home/deck/yt-music-headers.txt
```

### Step 3: Connect the plugin

1. Open YouTube Music Unified in Decky and select the **gear** icon.
2. Open **Settings → Account**.
3. Enter `/home/deck/yt-music-headers.txt` as the headers path.
4. Select **Load & Connect** and wait for the **Authenticated** status.

If authentication expires, repeat the export and replace the file. Reinstalling the plugin is not required. Browser credentials commonly last a long time, but Google can invalidate them at any time.

## Cast setup

1. Open Settings → Cast Receiver.
2. Select **Trust this network** on the network you will use.
3. Change the receiver name if desired.
4. In YouTube or YouTube Music, choose the Deck from the Cast button.

Both devices must be on the same LAN. Client isolation, multicast filtering, and some mesh networks can prevent discovery.

## Queue and sender behavior

During Cast, the sender's queue is the initial source. From Queue, you can move a track or mark it as next. The receiver keeps that order while advancing, going back, or finishing a song. A new queue sent by the sender replaces the local order. Some apps may continue showing their original order because the protocol does not provide a portable queue-write operation.

## Notifications

Settings → Notifications provides independent switches for **Device connected**, **Connection sound**, **Now playing**, and **Song change sound**. Notifications use Decky's native Steam UI, include the device name or album art/title/artist, and work with Quick Access closed. They do not add a polling process or duplicate pause/resume alerts.

With Steamcord installed, native notifications may remain hidden. The plugin avoids rerouting them into chat-style messages.

## Fullscreen lyrics

Press **X** to open fullscreen or use the expand icon beside Back in the compact reader. **B** returns to Player. When YouTube Music provides timestamps, the current lyric line is highlighted and kept centered using the actual audio position, including pauses and seeks. LRCLIB is a fallback when title, artist and duration match. This follows complete phrases, not individual words. Manual scrolling pauses automatic following for five seconds. Songs without timings retain the gentle reading loop, which waits five seconds at the bottom before restarting. Plugin notifications are suppressed while fullscreen is open. The fullscreen view requests temporary wake protection, released when leaving the view. Availability depends on Steam/CEF; forced shutdown and battery exhaustion are not prevented.

Lyrics are fetched on demand and cached for up to six tracks. YouTube requests use a separate anonymous client. If a timing fallback is needed, LRCLIB receives song metadata (title, artist, album and duration), never Google cookies or audio. Availability and alignment depend on the provider and song version.

The subdued `Source:` credit names the provider reported by the lyrics response (for example, Musixmatch or LyricFind), or LRCLIB when its matching timed lyrics are used. YouTube Music remains the source label if no more specific provider is reported. Untimed lyrics only loop automatically in fullscreen; the compact reader stays manual. Timed lyrics follow playback in both views.

Fullscreen receives initial controller focus: use **A** to play/pause and **B** to return. The redundant Exit button has been removed. The compact reader retains manual bumper scrolling without displaying the old instruction text.

Cover colors are sampled from a 32×32 canvas once per artwork with a bounded cache, using lightweight color quantization rather than a new palette dependency. If CORS prevents sampling, the neutral accent remains. Only fullscreen animates the background; the animation pauses when the document is hidden and respects reduced-motion preferences. This is ambient motion, not audio beat detection.

### Playback history and view counts

Library playback currently extracts an audio URL and plays it through an audio element; it does not explicitly submit an account-history entry. Cast's receiver dependency attempts to mark videos watched during some playlist-navigation flows, so history can behave differently when casting. Neither path guarantees that every play appears in account history or counts toward YouTube's official views, artist statistics, royalties, or Recap. Those are determined by YouTube, not by this plugin.

## Build on Windows

Requirements: Node.js, pnpm, Python, and PowerShell.

```powershell
pnpm install
pnpm run build
pnpm run build:backend
pnpm run package
```

`build.ps1` installs `ytmusicapi` into `py_modules/` and downloads Linux Node.js and yt-dlp binaries when missing. Run tests with:

```powershell
pnpm test
pnpm run test:python
```

The package uses this Decky-compatible layout:

```text
YouTube Music/
  main.py
  package.json
  plugin.json
  dist/index.js
  backend/out/server.cjs
  backend/xml/
  py_modules/
  bin/node
  bin/yt-dlp
```

## Architecture

- `src/`: React/TypeScript Quick Access interface.
- `src/services/audioManager.ts`: persistent audio, Cast WebSocket, progress, and events.
- `src/services/notifications.tsx`: notification preferences and native alerts.
- `main.py`: authentication, library, local playback, and local queue.
- `backend/src/`: Node Cast receiver and queue operations.
- `py_modules/`: vendored Python dependencies.
- `bin/`: Linux binaries included in the package.

## Maintainer and acknowledgments

**YouTube Music Unified is developed and maintained by [josejuanlr98](https://github.com/josejuanlr98).** This project brings together playback and Cast with its own integrated interface, queue tools, fullscreen lyrics, controller navigation, notifications, and subsequent fixes.

The original foundations include code and ideas from these two projects by **artistro08**. Credit here refers to those upstream projects, not authorship of the Unified changes:


- [decky-youtube-music-player](https://github.com/artistro08/decky-youtube-music-player): player, authentication, library, and controls.
- [youtube-cast-receiver](https://github.com/artistro08/youtube-cast-receiver): Cast receiver, especially [release v0.4.1](https://github.com/artistro08/youtube-cast-receiver/releases/tag/v0.4.1).
- [yt-cast-receiver](https://www.npmjs.com/package/yt-cast-receiver): Node implementation of the Cast protocol.
- [ytmusicapi](https://github.com/sigma67/ytmusicapi): unofficial YouTube Music client.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp): stream extractor.

Development assistance: **ChatGPT / Codex (OpenAI)**. **Google Gemini** was used as a secondary consultation resource.

This repository's implementation is released under BSD-3-Clause. Dependencies retain their own licenses. GitHub Actions runs typechecking, builds, and Python/Node tests on every push and pull request.

## Troubleshooting

**Not authenticated:** verify the path and export fresh `yt-music-headers.txt`.

**The Deck does not appear for Cast:** verify the same network, Trust this network, and router isolation/multicast settings.

**The queue returns to its previous order:** the sender sent a new queue update.

**Lyrics unavailable:** some songs do not provide lyrics.

## License

BSD-3-Clause. See [LICENSE](LICENSE).
