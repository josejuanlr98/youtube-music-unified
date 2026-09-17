import { call } from '@decky/api';

export type LyricsResult = { lyrics?: string | null; source?: string | null; error?: string };
// Small bounded cache; populated only when the lyrics screen is opened.
const cache = new Map<string, LyricsResult>();
export async function loadLyrics(videoId: string): Promise<LyricsResult> {
  const cached = cache.get(videoId);
  if (cached) return cached;
  const result = await call<[string], LyricsResult>('get_lyrics', videoId);
  if (!result.error && result.lyrics) {
    if (cache.size >= 6) cache.delete(cache.keys().next().value!);
    cache.set(videoId, result);
  }
  return result;
}
export function clearLyricsCache() { cache.clear(); }
