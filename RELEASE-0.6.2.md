# YouTube Music Unified 0.6.2

- Cast-only mode is automatic when no YouTube Music account is configured.
- Player and Queue remain accessible without importing browser headers.
- Library explains the optional sign-in step; account-only controls are disabled while signed out.
- The player explains how to enable Cast on a trusted network and start casting from another device.
- Signing in or out refreshes account access without polling or restarting the plugin.
- Clean builds now apply the same ytmusicapi compatibility patch included in previous release packages.

Install `youtube-music-unified-0.6.2.zip` using Decky's Install from ZIP option. The source ZIP is intended for development. Existing account and Cast settings are retained.

Validation: TypeScript checks, frontend/backend builds, Node and Python regressions, and backend unit tests. Physical Steam Deck validation of the new interface remains to be performed.
