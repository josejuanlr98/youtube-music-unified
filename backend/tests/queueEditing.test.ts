import { describe, it, expect, vi } from 'vitest';
import { CastPlayer } from '../src/CastPlayer.js';

function setup(ids = ['a','b','c','d']) {
  const ws = { broadcast:vi.fn() };
  const player = new CastPlayer({ ytdlpPath:'unused', wsManager:ws as any, dataStore:{ get:async () => null } as any });
  player.queue.videoIds.push(...ids);
  player.queue.setAsCurrent({ id:'b', client:'YTMUSIC', context:{ index:1 } } as any);
  (player as any).sessionCleared = false;
  (player as any).playing = true;
  (player as any).currentPosition = 42;
  for (const id of ids) (player as any).metadataCache.set(id, { title:id, artist:'Artist', albumArt:'' });
  vi.spyOn(player, 'notifyExternalStateChange').mockResolvedValue();
  return { player, ws };
}
describe('Cast queue editing', () => {
  it('moves without interrupting playback and uses that order for next/previous/end', async () => {
    const { player } = setup();
    const play = vi.spyOn(player, 'play').mockResolvedValue(true);
    expect((await player.editQueue(3, 'next', ['a','b','c','d'])).ok).toBe(true);
    expect(player.getQueueWithMetadata().tracks.map(t => t.videoId)).toEqual(['a','b','d','c']);
    expect(player.isCurrentlyPlaying()).toBe(true);
    expect(await player.getPosition()).toBe(42);
    expect(play).not.toHaveBeenCalled();
    await player.next(); expect(play.mock.calls.at(-1)?.[0].id).toBe('d');
    await player.previous(); expect(play.mock.calls.at(-1)?.[0].id).toBe('a');
    await player.handleTrackEnded(); expect(play.mock.calls.at(-1)?.[0].id).toBe('d');
  });
  it('moves the current item while preserving its identity', async () => {
    const { player } = setup();
    await player.editQueue(1, 'down', ['a','b','c','d']);
    expect(player.getQueueWithMetadata().position).toBe(2);
    expect((await player.getState()).queue.current?.id).toBe('b');
    expect((await player.getState()).queue.next?.id).toBe('d');
  });
  it('rejects stale snapshots, duplicates, invalid actions and active-song play-next', async () => {
    const { player } = setup();
    for (const [index, action, ids] of [[3,'up',['old']], [1,'next',['a','b','c','d']], [-1,'up',['a','b','c','d']], [0,'oops',['a','b','c','d']]] as const)
      expect((await player.editQueue(index, action, [...ids])).ok).toBe(false);
    const duplicate = setup(['a','b','a']);
    expect((await duplicate.player.editQueue(0,'next',['a','b','a'])).ok).toBe(false);
  });
  it('new sender playlists and disconnect discard the Deck arrangement', async () => {
    const { player } = setup();
    await player.editQueue(3, 'next', ['a','b','c','d']);
    player.clearDeckOrder();
    expect(player.getQueueWithMetadata().tracks.map(t => t.videoId)).toEqual(['a','b','c','d']);
    await player.editQueue(3, 'next', ['a','b','c','d']);
    player.clearOnDisconnect();
    expect(player.getQueueWithMetadata().tracks).toEqual([]);
    expect((await player.editQueue(0, 'down', ['a','b','c','d'])).ok).toBe(false);
  });
});
