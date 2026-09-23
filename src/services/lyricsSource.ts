/** Providers sometimes already include one or more localized source labels. */
export function lyricsSource(source?: string | null) {
  return (source || '').trim().replace(/^(?:(?:source|fuente)\s*:\s*)+/i, '').trim();
}
