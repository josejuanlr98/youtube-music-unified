# YouTube Music Unified 0.6.5

## Fullscreen reading mode
- Centered artwork and song details, with a Cast icon and sender name above the cover when connected.
- Centered artwork for songs without lyrics and a YouTube Music empty state.
- Discreet Exit button with initial controller focus; removed redundant headings and scroll hints.
- Gentle automatic lyrics scrolling: wait five seconds at the bottom, return to the top, and repeat. Manual scrolling pauses it for ten seconds. This is not synchronized karaoke.
- Suppress this plugin's notifications while fullscreen is open and restore normal notification behavior on exit.

## Search
- Compact Play next icon matching Queue, supporting local playback and active Cast sessions without interrupting the current song.

## Installation
Download `youtube-music-unified-0.6.5.zip` and install it through Decky's ZIP installer, then restart Decky. The `-source.zip` contains source code and is not the normal installer. Existing settings are preserved.

Press X for fullscreen, B to return, and L1/R1 to scroll manually. Includes the previously released playback, library, Cast, queue, and notification features.

Validated with TypeScript checks, frontend regression tests, Python tests, Cast backend tests, and a user-tested beta on Steam Deck. Exact fullscreen RAM usage has not been profiled on hardware.
