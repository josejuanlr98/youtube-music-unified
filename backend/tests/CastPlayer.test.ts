import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CastPlayer } from '../src/CastPlayer.js';

function createMockWsManager() {
  return { broadcast: vi.fn(), onMessage: vi.fn(), close: vi.fn() };
}

function createMockDataStore() {
  return { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), flush: vi.fn() };
}

describe('CastPlayer', () => {
  let player: CastPlayer;
  let ws: ReturnType<typeof createMockWsManager>;

  beforeEach(() => {
    ws = createMockWsManager();
    player = new CastPlayer({
      ytdlpPath: '/fake/yt-dlp',
      wsManager: ws as any,
      dataStore: createMockDataStore() as any,
    });
  });

  describe('clearOnDisconnect()', () => {
    it('broadcasts stop then empty queue in order', () => {
      // Put player in active state
      (player as any).playing = true;
      (player as any).sessionCleared = false;
      (player as any).currentTrackInfo = { videoId: 'abc', title: 'Test', artist: 'Artist', albumArt: '', duration: 180, url: '' };
      (player as any).currentPosition = 42;
      (player as any).currentDuration = 180;

      player.clearOnDisconnect();

      // Verify order: stop first, then empty queue
      expect(ws.broadcast.mock.calls[0]).toEqual(['stop', {}]);
      expect(ws.broadcast.mock.calls[1]).toEqual(['queue', { tracks: [], position: -1 }]);
    });

    it('clears internal state', () => {
      // Put player in active state
      (player as any).playing = true;
      (player as any).sessionCleared = false;
      (player as any).currentTrackInfo = { videoId: 'abc', title: 'Test', artist: 'Artist', albumArt: '', duration: 180, url: '' };
      (player as any).currentPosition = 42;
      (player as any).currentDuration = 180;

      player.clearOnDisconnect();

      expect(player.getCurrentTrackInfo()).toBeNull();
      expect(player.isCurrentlyPlaying()).toBe(false);
    });

    it('is idempotent — no-ops when already cleared', () => {
      player.clearOnDisconnect();

      // No broadcasts when there was nothing to clear
      expect(ws.broadcast).not.toHaveBeenCalled();
    });
  });
});
