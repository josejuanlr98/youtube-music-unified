import { ButtonItem, DialogButton, TextField, Focusable, Navigation, QuickAccessTab } from '@decky/ui';
import { call } from '@decky/api';
import { useEffect, useRef, useState } from 'react';
import { FaMusic } from 'react-icons/fa';
import { MdPlaylistPlay } from 'react-icons/md';
import { playTrack, getIsCastConnected, type TrackInfo } from '../services/audioManager';

interface SearchResult {
  videoId: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: string;
}

const PaddedSearchButton = (props: React.ComponentProps<typeof ButtonItem>) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.firstElementChild as HTMLElement | null;
    if (first) first.style.padding = '10px';
  }, []);
  return <div ref={ref} style={{ marginTop: '8px', marginLeft: '-10px', marginRight: '-10px' }}><ButtonItem {...props} /></div>;
};

export const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingSong, setLoadingSong] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [queued, setQueued] = useState<string | null>(null);
  const busy = useRef(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setError('');
    setSearching(true);
    setHasSearched(true);
    try {
      const result = await call<[string], { results?: SearchResult[]; error?: string }>('search_songs', query.trim());
      if (result.error) {
        setError(result.error);
        setResults([]);
      } else {
        setResults(result.results ?? []);
      }
    } catch (e) {
      setError(String(e));
    }
    setSearching(false);
  };

  const handleSongTap = async (song: SearchResult) => {
    if (busy.current) return;
    const videoId = song.videoId;
    setLoadingSong(videoId);
    setError('');
    try {
      const result = await call<[string, SearchResult], TrackInfo & { error?: string }>('play_song', videoId, song);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        await playTrack(result as TrackInfo);
        Navigation.NavigateBack();
        Navigation.OpenQuickAccessMenu(QuickAccessTab.Decky);
        return;
      }
    } catch (e) {
      setError(String(e));
    }
    setLoadingSong(null);
  };

  const queueNext = async (song: SearchResult) => {
    if (busy.current || loadingSong) return;
    busy.current = true; setLoadingSong(song.videoId); setError(''); setQueued(null);
    try {
      if (getIsCastConnected()) {
        const response = await fetch('http://127.0.0.1:39281/api/queue/next', {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(song)
        });
        const value = await response.json();
        if (!response.ok || !value.ok) throw new Error(value.message || 'Could not queue song.');
      } else {
        const value = await call<[SearchResult], {success?:boolean;error?:string}>('queue_song_next', song);
        if (!value.success) throw new Error(value.error || 'Could not queue song.');
      }
      setQueued(song.videoId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not queue song.'); }
    finally { busy.current = false; setLoadingSong(null); }
  };

  return (
    <div className="ytm-ui" style={{ background:'#101823', padding: '56px 24px 24px', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Search input */}
      <div style={{ flexShrink: 0, padding: '8px 12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--gpSystemLighterGrey)', marginBottom: '6px' }}>Find your next song</div>
        <TextField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearch(); } }}
        />
        <PaddedSearchButton onClick={() => { void handleSearch(); }}>
          {searching ? 'Searching...' : 'Search'}
        </PaddedSearchButton>
      </div>

      {/* Scrollable results area */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Error */}
        {error && (
          <div style={{ padding: '8px 12px', color: '#ff6b6b', fontSize: '12px' }}>{error}</div>
        )}

        {/* No results */}
        {hasSearched && !searching && results.length === 0 && !error && (
          <div style={{ padding: '8px 12px', color: 'var(--gpSystemLighterGrey)', fontSize: '12px' }}>
            No results found
          </div>
        )}

        {/* Results */}
        {results.map((song) => {
          const isLoading = loadingSong === song.videoId;
          return (
            <Focusable
              flow-children="horizontal" key={song.videoId}
              style={{ display: 'flex', alignItems: 'stretch', marginTop: '2px', marginBottom: '2px' }}
            >
              <DialogButton className="ytm-button ytm-list-row"
                style={{
                  flex: 1,
                  textAlign: 'left',
                  height: 'auto',
                  minHeight: '44px',
                  padding: '0',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  opacity: isLoading ? 0.6 : 1,
                }}
                disabled={loadingSong !== null}
                onClick={() => { if (!isLoading) void handleSongTap(song); }}
              >
                {/* Thumbnail */}
                <div style={{ width: '60px', height: '60px', flexShrink: 0, alignSelf: 'center', background: 'rgba(255,255,255,0.05)' }}>
                  {song.albumArt ? (
                    <img src={song.albumArt} alt="" style={{ width: '60px', height: '60px', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gpSystemLighterGrey)' }}>
                      <FaMusic size={18} />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0, padding: '.55rem 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textOverflow: 'ellipsis' }}>
                      {isLoading ? 'Loading...' : song.title}
                    </span>
                  </div>
                  {song.artist && (
                    <div style={{ fontSize: '11px', color: 'var(--gpSystemLighterGrey)', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {song.artist}
                    </div>
                  )}
                </div>
              </DialogButton>
              <DialogButton className="ytm-button" disabled={loadingSong !== null} onOKActionDescription="Play next" aria-label={queued === song.videoId ? 'Queued next' : 'Play next'}
                style={{ width:36, minWidth:0, height:60, minHeight:60, maxHeight:60, flexShrink:0, margin:0, padding:0, display:'flex', alignItems:'center', justifyContent:'center', color:queued === song.videoId ? '#1a9fff' : undefined }}
                onClick={() => void queueNext(song)}><MdPlaylistPlay size={19} /></DialogButton>
            </Focusable>
          );
        })}
      </div>
    </div>
  );
};
