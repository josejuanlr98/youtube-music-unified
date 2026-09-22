import { call } from '@decky/api';
import type { TrackInfo } from '../types';
export type TimedLine = { text: string; start: number; end: number };

export type LyricsResult = {
  lyrics?: string | null;
  source?: string | null;
  error?: string;
  timedLines?: TimedLine[];
  timingSource?: 'youtube' | 'lrclib' | null;
};
// Small bounded cache; populated only when the lyrics screen is opened.
const cache = new Map<string, LyricsResult>();
export async function loadLyrics(videoId: string, track?: TrackInfo): Promise<LyricsResult> {
  const metadata = track ? { title:track.title, artist:track.artist, album:track.album, duration:track.duration } : undefined;
  const key = JSON.stringify([videoId, metadata]);
  const cached = cache.get(key);
  if (cached) return cached;
  const result = await call<[string, typeof metadata], LyricsResult>('get_lyrics', videoId, metadata)
    .catch(() => ({ error: 'Could not load lyrics. Please try again.' } as LyricsResult));
  if (!result.error && result.lyrics) {
    if (cache.size >= 6) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
  }
  return result;
}
export function clearLyricsCache() { cache.clear(); }
