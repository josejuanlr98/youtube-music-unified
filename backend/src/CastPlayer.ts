import { Player, Constants } from 'yt-cast-receiver';
import type { Volume, Video } from 'yt-cast-receiver';
import { extractAudioInfo, type AudioInfo } from './ytdlp.js';
import type { WsManager } from './wsManager.js';
import type { JsonDataStore } from './JsonDataStore.js';

export interface CastPlayerOptions {
  ytdlpPath: string;
  wsManager: WsManager;
  dataStore: JsonDataStore;
}

export class CastPlayer extends Player {
  private ytdlpPath: string;
  private ws: WsManager;
  private store: JsonDataStore;
  private currentVolume: Volume = { level: 100, muted: false };
  private currentPosition: number = 0;
  private currentDuration: number = 0;
  private currentTrackInfo: AudioInfo | null = null;
  private playing: boolean = false;
  private lastSenderActivity: number = 0;
  private sessionCleared: boolean = true;
  private playbackGeneration = 0;
  private deckOrder: string[] | null = null;

  /** An incoming sender playlist takes priority over a Deck-side arrangement. */
  clearDeckOrder(): void { this.deckOrder = null; }

  async editQueue(index: number, action: string, expectedIds: string[]) {
    const ids = this.deckOrder ?? this.queue.videoIds;
    const current = this.queue.current;
    if (this.sessionCleared || !current || !Array.isArray(expectedIds) ||
        expectedIds.length !== ids.length || expectedIds.some((id, i) => id !== ids[i]))
      return { ok:false, message:'Queue changed. Please try again.' };
    if (!Number.isInteger(index) || index < 0 || index >= ids.length)
      return { ok:false, message:'Invalid queue position' };
    // The receiver identifies songs by videoId; ambiguous occurrences cannot be edited safely.
    if (new Set(ids).size !== ids.length)
      return { ok:false, message:'This Cast queue contains duplicates. Arrange it on your device.' };
    const playing = ids.indexOf(current.id);
    if (playing < 0) return { ok:false, message:'No current song' };
    const target = action === 'next' ? (index < playing ? playing : playing + 1)
      : action === 'up' ? index - 1 : action === 'down' ? index + 1 : -1;
    if (action === 'next' && index === playing) return { ok:false, message:'This song is already playing' };
    if (target < 0 || target >= ids.length) return { ok:false, message:'Invalid destination' };
    const order = [...ids];
    order.splice(target, 0, order.splice(index, 1)[0]);
    this.deckOrder = order;
    this.ws.broadcast('queue', this.getQueueWithMetadata());
    await this.notifyExternalStateChange();
    return { ok:true, ...this.getQueueWithMetadata() };
  }

  private orderedVideo(index: number): Video | null {
    const current = this.queue.current;
    const id = this.deckOrder?.[index];
    if (!current || !id) return null;
    // Do not keep the original playlist index/params after rearranging its songs.
    return { id, client:current.client } as Video;
  }

  override getNavInfo() {
    if (!this.deckOrder) return super.getNavInfo();
    const position = this.deckOrder.indexOf(this.queue.current?.id ?? '');
    return { hasPrevious:position > 0, hasNext:position >= 0 && position < this.deckOrder.length - 1, autoplayMode:this.autoplayMode };
  }

  override async getState() {
    const state = await super.getState();
    if (!this.deckOrder) return state;
    const position = this.deckOrder.indexOf(state.queue.current?.id ?? '');
    return { ...state, queue:{ ...state.queue, videoIds:[...this.deckOrder],
      current:state.queue.current ? { ...state.queue.current, context:{ ...state.queue.current.context, index:position } } : null,
      previous:this.orderedVideo(position - 1), next:this.orderedVideo(position + 1), autoplay:null } };
  }

  override async next(AID?: number | null): Promise<boolean> {
    if (!this.deckOrder) return super.next(AID);
    const position = this.deckOrder.indexOf(this.queue.current?.id ?? '');
    const video = position >= 0 ? this.orderedVideo(position + 1) : null;
    if (video) return this.play(video, 0, AID);
    await this.stop(AID);
    return false;
  }

  override async previous(AID?: number | null): Promise<boolean> {
    if (!this.deckOrder) return super.previous(AID);
    const video = this.orderedVideo(this.deckOrder.indexOf(this.queue.current?.id ?? '') - 1);
    return video ? this.play(video, 0, AID) : false;
  }
  private metadataCache: Map<string, AudioInfo> = new Map();
  private volumeBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private batchVolumeExtreme: number = 100;
  private batchDirection: number = 0; // 1=up, -1=down, 0=undetermined

  constructor(options: CastPlayerOptions) {
    super();
    this.ytdlpPath = options.ytdlpPath;
    this.ws = options.wsManager;
    this.store = options.dataStore;
    // Load persisted volume
    void this.store.get<Volume>('volume').then((vol) => {
      if (vol) this.currentVolume = vol;
    });
  }

  /**
   * Called by frontend via WebSocket 'progress' messages.
   * Updates position/duration so the library can relay to the phone.
   */
  updateProgress(currentTime: number, duration: number): void {
    this.currentPosition = currentTime;
    this.currentDuration = duration;
  }

  /**
   * Called by frontend via WebSocket 'ended' message.
   * Notifies the library that the track finished so it can advance.
   */
  async handleTrackEnded(): Promise<void> {
    this.playing = false;
    if (this.deckOrder) { await this.next(); return; }

    if (this.queue.hasNext) {
      console.log('[YTCast] Track ended, advancing to next');
      await this.next();
      return;
    }

    // hasNext can be wrong after queue jumps via playVideoById() — the
    // constructed Video lacks context.index, so the library's isLast
    // getter defaults to true. Fall back to checking videoIds directly.
    const videoIds = this.queue.videoIds;
    const currentId = this.queue.current?.id;
    const currentIndex = currentId ? videoIds.indexOf(currentId) : -1;

    if (currentIndex >= 0 && currentIndex < videoIds.length - 1) {
      const nextId = videoIds[currentIndex + 1];
      console.log(`[YTCast] Track ended, advancing via fallback to ${nextId}`);
      await this.playVideoById(nextId);
    } else {
      console.log('[YTCast] Track ended, no more tracks in queue');
      await this.notifyExternalStateChange(Constants.PLAYER_STATUSES.STOPPED);
    }
  }

  /**
   * Called by frontend via WebSocket 'playbackError' message.
   * Re-extracts the URL and sends it again.
   */
  async handlePlaybackError(): Promise<void> {
    if (!this.currentTrackInfo) return;
    const generation = this.playbackGeneration;

    try {
      const info = await extractAudioInfo(this.currentTrackInfo.videoId, this.ytdlpPath);
      if (generation !== this.playbackGeneration) return;
      this.currentTrackInfo = info;
      this.ws.broadcast('track', {
        videoId: info.videoId,
        title: info.title,
        artist: info.artist,
        albumArt: info.albumArt,
        duration: info.duration,
        url: info.url,
      });
    } catch (err) {
      if (generation !== this.playbackGeneration) return;
      this.ws.broadcast('error', {
        message: `Failed to re-extract URL: ${(err as Error).message}`,
        code: 'YTDLP_RETRY_FAILED',
      });
      // Try advancing to the next track
      try {
        await this.next();
      } catch {
        // Nothing more we can do
      }
    }
  }

  /**
   * Clear player state when all senders disconnect.
   * Stops playback and broadcasts cleared state to the frontend.
   * Named to avoid shadowing Player.reset() from yt-cast-receiver.
   * Idempotent — no-ops if already cleared.
   */
  clearOnDisconnect(): void {
    this.deckOrder = null;
    this.playbackGeneration++;
    if (this.sessionCleared) return;
    this.playing = false;
    this.currentTrackInfo = null;
    this.currentPosition = 0;
    this.currentDuration = 0;
    this.sessionCleared = true;
    this.ws.broadcast('stop', {});
    this.ws.broadcast('queue', { tracks: [], position: -1 });
  }

  /** Record that a sender-initiated action occurred. */
  markSenderActivity(): void {
    this.lastSenderActivity = Date.now();
  }

  /** Milliseconds since the last sender-initiated action. */
  getSenderIdleMs(): number {
    if (this.lastSenderActivity === 0) return Infinity;
    return Date.now() - this.lastSenderActivity;
  }

  getCurrentTrackInfo(): AudioInfo | null {
    return this.currentTrackInfo;
  }

  isCurrentlyPlaying(): boolean {
    return this.playing;
  }

  getQueueWithMetadata(): { tracks: Array<{ videoId: string; title: string; artist: string; albumArt: string; isCurrent: boolean }>; position: number } {
    if (this.sessionCleared) return { tracks: [], position: -1 };
    const playlist = this.queue;
    const state = playlist.getState();
    const videoIds = this.deckOrder ?? playlist.videoIds;
    const currentIndex = state.current
      ? videoIds.indexOf(state.current.id)
      : -1;

    const tracks = videoIds.map((id: string) => {
      const cached = this.metadataCache.get(id);
      return {
        videoId: id,
        title: cached?.title ?? id,
        artist: cached?.artist ?? '',
        albumArt: cached?.albumArt ?? '',
        isCurrent: state.current?.id === id,
      };
    });

    // Fetch oEmbed metadata for uncached items in the background
    const uncachedIds = videoIds.filter((id) => !this.metadataCache.has(id));
    if (uncachedIds.length > 0) {
      void this.enrichQueueMetadata(uncachedIds);
    }

    return { tracks, position: currentIndex };
  }

  private async enrichQueueMetadata(videoIds: string[]): Promise<void> {
    let enriched = false;
    for (const id of videoIds) {
      if (this.metadataCache.has(id)) continue;
      const meta = await this.fetchMetadataFromOembed(id);
      if (meta) {
        this.metadataCache.set(id, {
          videoId: id,
          title: meta.title,
          artist: meta.artist,
          albumArt: meta.albumArt,
          duration: 0,
          url: '',
        });
        enriched = true;
      }
    }
    // If we enriched any items, broadcast updated queue
    if (enriched) {
      const updatedQueue = this.getQueueWithMetadata();
      this.ws.broadcast('queue', updatedQueue);
    }
  }

  private async fetchMetadataFromOembed(videoId: string): Promise<{ title: string; artist: string; albumArt: string } | null> {
    try {
      const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json() as { title?: string; author_name?: string; thumbnail_url?: string };
      return {
        title: data.title ?? videoId,
        artist: data.author_name ?? '',
        albumArt: data.thumbnail_url ?? '',
      };
    } catch {
      return null;
    }
  }

  /**
   * Jump to a specific video in the queue by ID.
   * Constructs a Video object using the current video's client.
   */
  async playVideoById(videoId: string): Promise<boolean> {
    const state = this.queue.getState();
    const client = state.current?.client;
    if (!client) {
      console.error('[YTCast] Cannot jump: no current client');
      return false;
    }
    try {
      return await this.play({ id: videoId, client } as any, 0);
    } catch (err) {
      console.error(`[YTCast] Jump to ${videoId} failed:`, (err as Error).message);
      return false;
    }
  }

  // --- Player abstract method implementations ---

  protected async doPlay(video: Video, position: number): Promise<boolean> {
    if (this.deckOrder && !this.deckOrder.includes(video.id)) this.deckOrder = null;
    const generation = ++this.playbackGeneration;
    try {
      this.markSenderActivity();
      this.sessionCleared = false;
      const info = await extractAudioInfo(video.id, this.ytdlpPath);
      if (generation !== this.playbackGeneration) return false;
      this.currentTrackInfo = info;
      this.metadataCache.set(video.id, info);
      this.currentPosition = position;
      this.currentDuration = info.duration;
      this.playing = true;

      // Defer track broadcast to next macrotask so a follow-up doPause
      // (which fires when phone connects in paused state) flips this.playing
      // before we tell the frontend whether to autoplay. Library calls
      // `await doPlay; await doPause` — microtasks drain between them, but
      // setTimeout(0) runs after both settle.
      setTimeout(() => {
        if (generation !== this.playbackGeneration) return;
        this.ws.broadcast('track', {
          videoId: info.videoId,
          title: info.title,
          artist: info.artist,
          albumArt: info.albumArt,
          duration: info.duration,
          url: info.url,
          autoplay: this.playing,
        });
        console.log(`[YTCast] Loaded: ${info.title} by ${info.artist} (${info.videoId}) autoplay=${this.playing}`);

        if (position > 0) {
          this.ws.broadcast('seek', { position });
        }

        // Broadcast updated queue so the current track indicator moves
        const queueData = this.getQueueWithMetadata();
        this.ws.broadcast('queue', queueData);
      }, 0);

      return true;
    } catch (err) {
      console.error(`[YTCast] doPlay failed for ${video.id}:`, (err as Error).message);
      this.ws.broadcast('error', {
        message: `Failed to play: ${(err as Error).message}`,
        code: 'YTDLP_FAILED',
      });
      return false;
    }
  }

  protected async doPause(): Promise<boolean> {
    this.markSenderActivity();
    this.playing = false;
    this.ws.broadcast('state', {
      isPlaying: false,
      position: this.currentPosition,
      duration: this.currentDuration,
    });
    return true;
  }

  protected async doResume(): Promise<boolean> {
    this.markSenderActivity();
    this.playing = true;
    this.ws.broadcast('state', {
      isPlaying: true,
      position: this.currentPosition,
      duration: this.currentDuration,
    });
    return true;
  }

  protected async doStop(): Promise<boolean> {
    this.playbackGeneration++;
    this.markSenderActivity();
    this.playing = false;
    this.currentTrackInfo = null;
    this.currentPosition = 0;
    this.currentDuration = 0;
    this.ws.broadcast('stop', {});
    return true;
  }

  protected async doSeek(position: number): Promise<boolean> {
    this.markSenderActivity();
    this.currentPosition = position;
    this.ws.broadcast('seek', { position });
    return true;
  }

  protected async doSetVolume(volume: Volume): Promise<boolean> {
    this.markSenderActivity();
    this.currentVolume = volume;

    // The DIAL/Lounge protocol oscillates volume values after rapid changes.
    // E.g. user presses up twice (50→55→60), then the protocol echoes 55
    // back as an ack-correction. We track the extreme (max for up, min for
    // down) in each batch and broadcast that, ignoring reversals.
    const isNewBatch = !this.volumeBroadcastTimer;

    if (this.volumeBroadcastTimer) {
      clearTimeout(this.volumeBroadcastTimer);
    }

    if (isNewBatch) {
      this.batchVolumeExtreme = volume.level;
      this.batchDirection = 0;
    } else if (this.batchDirection === 0) {
      // Second+ value in batch, direction not yet determined
      if (volume.level > this.batchVolumeExtreme) {
        this.batchDirection = 1;
        this.batchVolumeExtreme = volume.level;
      } else if (volume.level < this.batchVolumeExtreme) {
        this.batchDirection = -1;
        this.batchVolumeExtreme = volume.level;
      }
    } else {
      // Direction established — extend extreme, ignore reversals (oscillation)
      if (this.batchDirection > 0 && volume.level > this.batchVolumeExtreme) {
        this.batchVolumeExtreme = volume.level;
      } else if (this.batchDirection < 0 && volume.level < this.batchVolumeExtreme) {
        this.batchVolumeExtreme = volume.level;
      }
    }

    this.volumeBroadcastTimer = setTimeout(() => {
      this.volumeBroadcastTimer = null;
      this.ws.broadcast('volume', { value: this.batchVolumeExtreme, muted: this.currentVolume.muted });
    }, 300);

    void this.store.set('volume', volume);
    return true;
  }

  protected async doGetVolume(): Promise<Volume> {
    return this.currentVolume;
  }

  protected async doGetPosition(): Promise<number> {
    return this.currentPosition;
  }

  protected async doGetDuration(): Promise<number> {
    return this.currentDuration;
  }
}
