# YouTube Music Unified 0.6.6

Real synchronized lyrics now highlight the current phrase and smoothly follow the audio in the compact reader and fullscreen, including pause/resume and seeking.

- YouTube Music timestamps are the primary source; LRCLIB is a fallback when title, artist and duration match.
- After manual scrolling, automatic following resumes after five seconds.
- Cleaner provider credit: YouTube Music logo and name followed by the source, without the Synced label. LRCLIB results retain their own attribution.
- Smaller Casting from label in fullscreen.
- Songs without timing data retain the existing reading loop, with a five-second pause at the bottom.

## Install
Download `youtube-music-unified-0.6.6.zip`, install it through Decky's ZIP installer and restart Decky. Existing settings are preserved. The `-source.zip` is for development.

Press X for fullscreen, B to return, and L1/R1 to scroll manually. Synchronization follows phrases, not individual words; coverage and alignment depend on the song and provider.

## Resources and privacy
Lyrics are fetched on demand and cached for six tracks. Following uses existing audio progress events, with no speech recognition or audio uploads. LRCLIB receives song metadata only when needed, never Google cookies. Listeners and manual-reading timers are cleaned up on exit.

## Validation
The synchronized-lyrics beta was tested by the maintainer on Steam Deck. Automated coverage checks cue conversion, fallback matching, rate limits, seeks, instrumental gaps, manual-scroll delay and cleanup. Live YouTube queries returned timestamps for Nobody New, Nicole Kidman and De Madrugá. Browser checks verified line highlighting and centering.
