# YouTube Music Unified 0.6.3

Fix notification sounds playing even when disabled in Settings → Notifications.

Steam's queued notification playback chooses sound from its notification type again, ignoring Decky's per-toast preference. This release checks that preference at playback time for YouTube Music Unified notifications only. Connection and track sounds remain independently configurable, with silent defaults. Steam achievements and other plugins retain their normal behavior.

Install `youtube-music-unified-0.6.3.zip` through Decky's Install from ZIP option. Restart Decky if the previous version remains loaded. Existing preferences are retained.

Validation: TypeScript check, frontend build, Node regression tests including delayed notification playback, separate sound preferences, unrelated notifications and cleanup. Actual sound behavior still needs confirmation on Steam Deck.
