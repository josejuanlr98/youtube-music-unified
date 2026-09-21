# YouTube Music Unified 0.6.4 — Fullscreen lyrics and Cast improvements

- Fullscreen lyrics with larger artwork and manual scrolling using the D-pad or L1/R1.
- Press X from Player or the compact lyrics reader to open fullscreen; B returns to Player.
- Compact expand button beside Back, outside the lyrics reading area.
- Temporary fullscreen wake protection, released on exit (Steam/CEF support required).
- Improved Cast recovery after interruptions and handling of delayed playback events.
- Avoid Steamcord rerouting YouTube Music alerts into chat messages. Native notifications may remain hidden with Steamcord.
- Updated project ownership and acknowledgments: maintained by josejuanlr98, with upstream attribution and original license notices retained.

## Install

Download youtube-music-unified-0.6.4.zip, install through Decky > Developer Options > Install from ZIP, and restart Decky. The -source.zip is for development. Existing account and notification settings are retained.

Lyrics use manual scrolling. Automatic karaoke synchronization and a global audio-output selector are not included.

## Validation

The final beta was tested and approved by the maintainer on Steam Deck. Frontend/backend builds, typechecking, JavaScript/Python regression suites and backend tests are checked before release.
