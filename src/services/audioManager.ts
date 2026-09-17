import { call } from '@decky/api';
import type { TrackInfo } from '../types';
export type { TrackInfo } from '../types';

const AUDIO_ID = 'ytm-audio-player';
const CAST_BACKEND = 'http://127.0.0.1:39281';
const CAST_WS = 'ws://127.0.0.1:39281';

let audioElement: HTMLAudioElement | null = null;
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let progressTimer: ReturnType<typeof setInterval> | null = null;

let currentTrack: TrackInfo | null = null;
let isPlaying = false;
let stoppingAll = false;
let stopInFlight: Promise<void> | null = null;
let playbackGeneration = 0;
let castConnected = false;
let castNetwork: NetworkInfo = { uuid: null, name: null, trusted: false };
let castSenderName: string | null = null;
let progressPosition = 0;
let progressDuration = 0;

let trackChangeListeners: Array<(track: TrackInfo | null) => void> = [];
let playbackStartedListeners: Array<(track: TrackInfo) => void> = [];
let senderConnectedListeners: Array<(name: string | null) => void> = [];
export function addPlaybackStartedListener(fn: (track: TrackInfo) => void) {
  playbackStartedListeners.push(fn);
  return () => { playbackStartedListeners = playbackStartedListeners.filter(l => l !== fn); };
}
export function addSenderConnectedListener(fn: (name: string | null) => void) {
  senderConnectedListeners.push(fn);
  return () => { senderConnectedListeners = senderConnectedListeners.filter(l => l !== fn); };
}
let playStateListeners: Array<(playing: boolean) => void> = [];
let castConnectionListeners: Array<(connected: boolean, senderName: string | null) => void> = [];
let networkListeners: Array<(info: NetworkInfo) => void> = [];
let queueListeners: Array<(tracks: TrackInfo[], position: number) => void> = [];
let progressListeners: Array<(position: number, duration: number) => void> = [];
let castQueue: { tracks: TrackInfo[]; position: number } = { tracks: [], position: -1 };

export interface NetworkInfo {
  uuid: string | null;
  name: string | null;
  trusted: boolean;
}

export function getCurrentTrack() { return currentTrack; }
export function getIsPlaying() { return isPlaying; }
export function getIsCastConnected() { return castConnected; }
export function getNetworkInfo() { return castNetwork; }
export function getCastSenderName() { return castSenderName; }
export function getProgress() { return { position: progressPosition, duration: progressDuration }; }

export function addTrackChangeListener(fn: (track: TrackInfo | null) => void) {
  trackChangeListeners.push(fn);
  return () => { trackChangeListeners = trackChangeListeners.filter((l) => l !== fn); };
}
export function addPlayStateListener(fn: (playing: boolean) => void) {
  playStateListeners.push(fn);
  return () => { playStateListeners = playStateListeners.filter((l) => l !== fn); };
}
export function addCastConnectionListener(fn: (connected: boolean, senderName: string | null) => void) {
  castConnectionListeners.push(fn);
  return () => { castConnectionListeners = castConnectionListeners.filter((l) => l !== fn); };
}
export function addNetworkListener(fn: (info: NetworkInfo) => void) {
  networkListeners.push(fn);
  return () => { networkListeners = networkListeners.filter((l) => l !== fn); };
}
export function getQueue() { return castQueue; }
export function addProgressListener(fn: (position: number, duration: number) => void) { progressListeners.push(fn); return () => { progressListeners = progressListeners.filter((l) => l !== fn); }; }
export function addQueueListener(fn: (tracks: TrackInfo[], position: number) => void) {
  queueListeners.push(fn);
  return () => { queueListeners = queueListeners.filter((l) => l !== fn); };
}
function notifyQueue(tracks: TrackInfo[], position: number) {
  castQueue = { tracks, position };
  queueListeners.forEach((fn) => fn(tracks, position));
  // Keep Decky's local queue in sync with the Cast queue so the Queue tab is
  // always the same queue shown by the phone during a Cast session.
  void call('sync_cast_queue', tracks, position).catch(() => {});
}

function notifyProgress(position: number, duration: number) { progressPosition = Math.max(0, position || 0); progressDuration = Math.max(0, duration || 0); progressListeners.forEach((fn) => fn(progressPosition, progressDuration)); }
function notifyTrack(track: TrackInfo | null) {
  currentTrack = track;
  trackChangeListeners.forEach((fn) => fn(track));
}
function notifyPlaying(value: boolean) {
  isPlaying = value;
  playStateListeners.forEach((fn) => fn(value));
  if (value && currentTrack) playbackStartedListeners.forEach(fn => fn(currentTrack!));
}
function notifyCastConnection(value: boolean) {
  castConnected = value;
  castConnectionListeners.forEach((fn) => fn(value, castSenderName));
}
function notifyNetwork(info: NetworkInfo) {
  castNetwork = info;
  networkListeners.forEach((fn) => fn(info));
}

async function castGet(path: string) {
  try {
    const res = await fetch(`${CAST_BACKEND}${path}`);
    return await res.json();
  } catch {
    return null;
  }
}
async function castPost(path: string, body?: unknown) {
  try {
    const res = await fetch(`${CAST_BACKEND}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export async function apiGetNetwork(): Promise<NetworkInfo | null> {
  return await castGet('/api/network/current');
}
export async function apiTrustNetwork() { return castPost('/api/network/trust'); }
export async function apiUntrustNetwork() { return castPost('/api/network/untrust'); }

function sendCast(event: string, data: unknown = {}) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data }));
  }
}

function startCastProgress() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (!audioElement || !castConnected || !isPlaying) return;
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
    notifyProgress(audioElement.currentTime, duration);
    sendCast('progress', { currentTime: audioElement.currentTime, duration });
  }, 1000);
}
function stopCastProgress() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

async function handleCastTrack(data: any) {
  if (!audioElement || !data?.url) return;
  const generation = playbackGeneration;
  const track: TrackInfo = {
    videoId: data.videoId ?? '',
    title: data.title ?? 'Unknown',
    artist: data.artist ?? '',
    album: data.album ?? '',
    albumArt: data.albumArt ?? '',
    duration: data.duration ?? 0,
    url: data.url,
    queuePosition: data.queuePosition,
    queueLength: data.queueLength,
  };
  audioElement.src = track.url || '';
  notifyProgress(0, track.duration || 0);
  notifyTrack(track);

  const autoplay = data.autoplay !== false;
  if (autoplay) {
    try {
      await audioElement.play();
      if (generation !== playbackGeneration) return;
      notifyPlaying(true);
      startCastProgress();
    } catch (e) {
      if (generation !== playbackGeneration) return;
      console.error('[YTM] Cast playback failed:', e);
      sendCast('playbackError', { message: String(e) });
      notifyPlaying(false);
    }
  } else {
    notifyPlaying(false);
  }
}

function handleCastMessage(msg: any) {
  if (stoppingAll && ['track', 'state', 'queue'].includes(msg.event)) return;
  switch (msg.event) {
    case 'track':
      void handleCastTrack(msg.data);
      break;
    case 'state':
      if (msg.data?.isPlaying && audioElement?.src && !isPlaying) {
        const generation = playbackGeneration;
        void audioElement.play().then(() => {
          if (generation !== playbackGeneration) return;
          notifyPlaying(true);
          startCastProgress();
        }).catch(() => {});
      } else if (!msg.data?.isPlaying && isPlaying) {
        audioElement?.pause();
        stopCastProgress();
        notifyPlaying(false);
      }
      break;
    case 'stop':
      audioElement?.pause();
      if (audioElement) audioElement.src = '';
      stopCastProgress();
      notifyPlaying(false);
      notifyTrack(null);
      notifyProgress(0, 0);
      break;
    case 'seek':
      if (audioElement && Number.isFinite(msg.data?.position)) {
        audioElement.currentTime = msg.data.position;
      }
      break;
    case 'queue':
      notifyQueue(msg.data?.tracks ?? [], msg.data?.position ?? -1);
      break;
    case 'connection':
      castSenderName = msg.data?.senderName ?? null;
      notifyCastConnection(!!msg.data?.phoneConnected);
      break;
    case 'senderConnected':
      senderConnectedListeners.forEach(fn => fn(msg.data?.senderName ?? null));
      break;
    case 'network':
      notifyNetwork({
        uuid: msg.data?.uuid ?? null,
        name: msg.data?.name ?? null,
        trusted: !!msg.data?.trusted,
      });
      break;
  }
}

function connectCast() {
  try {
    ws = new WebSocket(CAST_WS);
  } catch {
    scheduleCastReconnect();
    return;
  }
  ws.onopen = () => {
    reconnectDelay = 1000;
    void castGet('/api/state').then((state) => {
      if (!state) return;
      if (state.track) notifyTrack(state.track);
      notifyProgress(Number(state.position ?? 0), Number(state.duration ?? state.track?.duration ?? 0));
      castSenderName = state.senderName ?? null;
      notifyCastConnection(!!state.connected);
      notifyCastConnection(!!state.connected);
    });
    void apiGetNetwork().then((n) => { if (n) notifyNetwork(n); });
    void castGet('/api/queue').then((q) => { if (q?.tracks) notifyQueue(q.tracks, q.position ?? -1); });
  };
  ws.onmessage = (event) => {
    try { handleCastMessage(JSON.parse(event.data as string)); } catch {}
  };
  ws.onclose = () => {
    castSenderName = null;
    notifyCastConnection(false);
    notifyProgress(0, 0);
    scheduleCastReconnect();
  };
  ws.onerror = () => {};
}
function scheduleCastReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connectCast();
  }, reconnectDelay);
}

function onAudioEnded() {
  stopCastProgress();
  if (castConnected) {
    sendCast('ended');
  } else {
    void handleLocalTrackEnded();
  }
}
function onAudioError() {
  if (stoppingAll || !currentTrack) return;
  if (castConnected) {
    sendCast('playbackError', { message: 'Audio playback error' });
  } else {
    void handleLocalError();
  }
}
function onAudioTimeUpdate() {
  if (!audioElement) return;
  const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
  notifyProgress(audioElement.currentTime, duration);
}

function onAudioPause() {
  if (isPlaying && !castConnected) {
    notifyPlaying(false);
    void call('pause');
  }
}

async function handleLocalTrackEnded() {
  const generation = playbackGeneration;
  try {
    const result = await call<[], TrackInfo & { stopped?: boolean; error?: string }>('track_ended');
    if (generation !== playbackGeneration) return;
    if (result.stopped) {
      notifyPlaying(false); notifyTrack(null); return;
    }
    if (result.error || !result.url) { notifyPlaying(false); return; }
    await loadAndPlay(result);
  } catch { notifyPlaying(false); }
}
async function handleLocalError() {
  const generation = playbackGeneration;
  try {
    const result = await call<[], TrackInfo & { error?: string }>('get_current_track');
    if (generation !== playbackGeneration) return;
    if (result.error || !result.url) {
      const next = await call<[], TrackInfo & { stopped?: boolean; error?: string }>('next_track');
      if (generation !== playbackGeneration) return;
      if (next.stopped || next.error) { notifyPlaying(false); return; }
      await loadAndPlay(next);
      return;
    }
    await loadAndPlay(result);
  } catch { notifyPlaying(false); }
}

async function loadAndPlay(track: TrackInfo) {
  if (stoppingAll || !audioElement || !track.url) return;
  const generation = playbackGeneration;
  audioElement.src = track.url;
  notifyTrack(track);
  try {
    await audioElement.play();
    if (generation !== playbackGeneration) return;
    notifyPlaying(true);
    if (!castConnected) void call('resume');
  } catch (e) {
    if (generation !== playbackGeneration) return;
    console.error('[YTM] play failed:', e);
    notifyPlaying(false);
  }
}

export function initAudio() {
  if (document.getElementById(AUDIO_ID)) {
    audioElement = document.getElementById(AUDIO_ID) as HTMLAudioElement;
  } else {
    audioElement = document.createElement('audio');
    audioElement.id = AUDIO_ID;
    audioElement.style.display = 'none';
    document.body.appendChild(audioElement);
  }
  audioElement.removeEventListener('ended', onAudioEnded);
  audioElement.removeEventListener('error', onAudioError);
  audioElement.removeEventListener('pause', onAudioPause);
  audioElement.removeEventListener('timeupdate', onAudioTimeUpdate);
  audioElement.addEventListener('ended', onAudioEnded);
  audioElement.addEventListener('error', onAudioError);
  audioElement.addEventListener('pause', onAudioPause);
  audioElement.addEventListener('timeupdate', onAudioTimeUpdate);
  connectCast();
}

export function destroyAudio() {
  stopCastProgress();
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  if (audioElement) {
    audioElement.pause(); audioElement.src = '';
    audioElement.removeEventListener('ended', onAudioEnded);
    audioElement.removeEventListener('error', onAudioError);
    audioElement.removeEventListener('pause', onAudioPause);
    audioElement.removeEventListener('timeupdate', onAudioTimeUpdate);
    audioElement.remove(); audioElement = null;
  }
  currentTrack = null; isPlaying = false; castConnected = false; castSenderName = null; progressPosition = 0; progressDuration = 0;
  castQueue = { tracks: [], position: -1 };
  trackChangeListeners = []; playStateListeners = [];
  playbackStartedListeners = []; senderConnectedListeners = [];
  castConnectionListeners = []; networkListeners = []; queueListeners = []; progressListeners = [];
}

export async function playTrack(track: TrackInfo) {
  // Taking control from the Deck explicitly ends the phone Cast session first.
  if (castConnected) {
    await disconnectCast();
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await loadAndPlay(track);
}
export function pausePlayback() {
  if (castConnected) {
    void castPost('/api/pause');
    return;
  }
  notifyPlaying(false);
  void call('pause');
  audioElement?.pause();
}
export function resumePlayback() {
  if (castConnected) {
    void castPost('/api/play');
    return;
  }
  if (audioElement?.src) {
    void audioElement.play().then(() => {
      notifyPlaying(true);
      void call('resume');
    }).catch(() => notifyPlaying(false));
  }
}
export function togglePlayback() {
  if (isPlaying) pausePlayback(); else resumePlayback();
}
export async function playNext() {
  if (castConnected) { await castPost('/api/next'); return; }
  const generation = playbackGeneration;
  const result = await call<[], TrackInfo & { stopped?: boolean; error?: string }>('next_track');
  if (generation !== playbackGeneration) return;
  if (result.stopped) { notifyPlaying(false); notifyTrack(null); return; }
  if (result.error || !result.url) return;
  await loadAndPlay(result);
}
export async function playPrevious() {
  if (castConnected) { await castPost('/api/prev'); return; }
  const generation = playbackGeneration;
  const result = await call<[], TrackInfo & { stopped?: boolean; error?: string }>('previous_track');
  if (generation !== playbackGeneration) return;
  if (result.stopped) return;
  if (result.error || !result.url) return;
  await loadAndPlay(result);
}
export function setAudioVolume(value: number) {
  if (audioElement) audioElement.volume = Math.max(0, Math.min(1, value / 100));
  if (!castConnected) void call('set_volume', value);
  else void castPost('/api/volume', { volume: value });
}
export function getAudioElement() { return audioElement; }

export function stopAllPlayback(): Promise<void> {
  if (stopInFlight) return stopInFlight;
  stoppingAll = true;
  playbackGeneration++;
  // Silence immediately; remove src instead of loading an empty URL.
  notifyPlaying(false);
  audioElement?.pause();
  audioElement?.removeAttribute('src');
  audioElement?.load();
  stopCastProgress();
  notifyTrack(null);
  notifyProgress(0, 0);
  stopInFlight = (async () => {
    // Ask the backend even if the UI missed a connection event.
    const results = await Promise.allSettled([
      disconnectCast(),
      call<[], { success?: boolean; error?: string }>('stop_all').then(result => {
        if (!result.success) throw new Error('Could not clear the local queue.');
      }),
    ]);
    if (results[0].status === 'fulfilled') {
      castSenderName = null;
      notifyCastConnection(false);
    }
    notifyQueue([], -1);
    const failed = results.some(result => result.status === 'rejected');
    if (failed) throw new Error('Audio stopped, but clearing or unlinking failed. Press Stop again to retry.');
  })().finally(() => { stoppingAll = false; stopInFlight = null; });
  return stopInFlight;
}

export async function disconnectCast() {
  const result = await castPost('/api/cast/disconnect');
  if (!result?.ok) throw new Error('Could not unlink and restart Cast. Please try again.');
}

export function seekPlayback(position: number) {
  const target = Math.max(0, position);
  if (castConnected) { void castPost('/api/seek', { position: target }); return; }
  if (audioElement) { audioElement.currentTime = target; notifyProgress(target, Number.isFinite(audioElement.duration) ? audioElement.duration : progressDuration); }
}
