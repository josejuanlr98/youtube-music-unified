import { describe, it, expect, vi } from 'vitest';
import { CastPlayer } from '../src/CastPlayer.js';
import { extractAudioInfo } from '../src/ytdlp.js';
import { Constants } from 'yt-cast-receiver';

vi.mock('../src/ytdlp.js', () => ({ extractAudioInfo:vi.fn() }));

function setup() {
  const ws = { broadcast:vi.fn() };
  const player = new CastPlayer({ ytdlpPath:'unused', wsManager:ws as any, dataStore:{ get:async () => null } as any });
  player.queue.videoIds.push('a', 'b', 'c');
  player.queue.setAsCurrent({ id:'b', client:'YTMUSIC', context:{ playlistId:'playlist', index:1, params:'old-token' } } as any);
  Object.assign(player, { sessionCleared:false, playing:true, playbackId:'current', currentTrackInfo:{ videoId:'b' }, currentPosition:42, currentDuration:180 });
  return player;
}

describe('Cast playback synchronization', () => {
  it('preserves previous state when the sender mutates its playlist in place', async () => {
    const player = setup();
    const previous = await player.getState();
    player.queue.current!.context!.index = 2;
    player.queue.videoIds.push('d');
    expect(previous.queue.current?.context?.index).toBe(1);
    expect(previous.queue.videoIds).toEqual(['a','b','c']);
  });
  it('ignores delayed progress, ended and error events from previous playback', async () => {
    const player = setup();
    const next = vi.spyOn(player, 'next').mockResolvedValue(true);
    const jump = vi.spyOn(player, 'playVideoById').mockResolvedValue(true);
    player.updateProgress(99, 100, 'old');
    player.updateProgress(NaN, 100, 'current');
    await player.handleTrackEnded('old');
    await player.handlePlaybackError('old');
    expect(await player.getPosition()).toBe(42);
    expect(next).not.toHaveBeenCalled();
    expect(jump).not.toHaveBeenCalled();
    await Promise.all([player.handleTrackEnded('current'), player.handleTrackEnded('current')]);
    expect(jump).toHaveBeenCalledTimes(1);
    expect(jump).toHaveBeenCalledWith('c');
  });

  it('resends the current identity on playback acknowledgement and every 30 seconds of progress', async () => {
    vi.useFakeTimers();
    try {
      const player = setup();
      const state = vi.fn(); player.on('state', state);
      await player.syncSender('current');
      expect(state).toHaveBeenCalledTimes(1);
      expect(state.mock.calls[0][0].previous).toBeNull();
      expect(state.mock.calls[0][0].current.queue.current.id).toBe('b');
      player.updateProgress(43, 180, 'current');
      await vi.advanceTimersByTimeAsync(29000);
      expect(state).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      player.updateProgress(73, 180, 'current');
      await vi.advanceTimersByTimeAsync(0);
      expect(state).toHaveBeenCalledTimes(2);
      player.clearOnDisconnect();
      await player.syncSender('current');
      expect(state).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it('queue jumps retain list identity and destination index without stale navigation tokens', async () => {
    const player = setup();
    const play = vi.spyOn(player, 'play').mockResolvedValue(true);
    expect(await player.playVideoById('c')).toBe(true);
    expect(play.mock.calls[0][0]).toEqual({ id:'c', client:'YTMUSIC', context:{ playlistId:'playlist', index:2 } });
    expect(await player.playVideoById('missing')).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('superseded extraction cannot stop or replace a newer song on the sender', async () => {
    const player = setup();
    player.setLogger({ info:vi.fn(), debug:vi.fn(), warn:vi.fn(), error:vi.fn() } as any);
    vi.spyOn(player, 'getQueueWithMetadata').mockReturnValue({ tracks:[], position:0 });
    let finish!: (value:any) => void;
    const first = new Promise<any>(resolve => { finish = resolve; });
    vi.mocked(extractAudioInfo).mockReset().mockReturnValueOnce(first).mockResolvedValueOnce({ videoId:'c', title:'C', artist:'', albumArt:'', url:'https://audio.test/c', duration:180 });
    const state = vi.fn(); player.on('state', state);
    const old = player.play({ id:'a', client:'YTMUSIC' } as any);
    await vi.waitFor(() => expect(extractAudioInfo).toHaveBeenCalledTimes(1));
    const latest = player.play({ id:'c', client:'YTMUSIC' } as any);
    finish({ videoId:'a', title:'A', duration:180 });
    expect(await old).toBe(false);
    expect(await latest).toBe(true);
    expect(player.getCurrentTrackInfo()?.videoId).toBe('c');
    expect(state.mock.calls.at(-1)?.[0].current).toMatchObject({ status:Constants.PLAYER_STATUSES.PLAYING, queue:{ current:{ id:'c' } } });
  });

  it('unlink cancels queued play requests before they can start', async () => {
    const player = setup();
    vi.mocked(extractAudioInfo).mockReset();
    const queued = player.play({ id:'a', client:'YTMUSIC' } as any);
    player.clearOnDisconnect();
    expect(await queued).toBe(false);
    expect(extractAudioInfo).not.toHaveBeenCalled();
  });
});
