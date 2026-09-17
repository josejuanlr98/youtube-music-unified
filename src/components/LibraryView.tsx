import { DialogButton, Focusable, Navigation } from '@decky/ui';
import { call } from '@decky/api';
import { useEffect, useState } from 'react';
import { FaHeart, FaMusic, FaSearch } from 'react-icons/fa';
import { playTrack, type TrackInfo } from '../services/audioManager';
import { Section } from './Section';
import { usePlayer } from '../context/PlayerContext';

interface PlaylistEntry {
  playlistId: string;
  title: string;
  count: number | null;
  thumbnail: string | null;
}

export const LibraryView = ({ onSwitchToPlayer }: { onSwitchToPlayer?: () => void }) => {
  const { authenticated } = usePlayer();
  if (!authenticated) return <Section>
    <div style={{ padding:16, textAlign:'center' }}>
      <div style={{ fontWeight:700, marginBottom:8 }}>Cast only</div>
      <div className="ytm-muted" style={{ fontSize:12, lineHeight:1.5, marginBottom:16 }}>
        Cast from another device without signing in here. Sign in to access your library, search, likes and lyrics.
      </div>
      <DialogButton onClick={() => { Navigation.CloseSideMenus(); Navigation.Navigate('/youtube-music-settings'); }}>Sign in to YouTube Music</DialogButton>
    </div>
  </Section>;
  return <AccountLibrary onSwitchToPlayer={onSwitchToPlayer} />;
};

const AccountLibrary = ({ onSwitchToPlayer }: { onSwitchToPlayer?: () => void }) => {
  const [playlists, setPlaylists] = useState<PlaylistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlaylist, setLoadingPlaylist] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchPlaylists = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await call<[], { playlists?: PlaylistEntry[]; error?: string }>('get_library_playlists');
      if (result.error) {
        setError(result.error);
      } else {
        setPlaylists(result.playlists ?? []);
      }
    } catch (e) {
      setError('Failed to load playlists');
    }
    setLoading(false);
  };

  useEffect(() => { void fetchPlaylists(); }, []);

  const handlePlaylistClick = async (playlistId: string) => {
    setLoadingPlaylist(playlistId);
    setError('');
    try {
      const result = await call<[string], TrackInfo & { error?: string }>('load_playlist', playlistId);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        await playTrack(result as TrackInfo);
        onSwitchToPlayer?.();
      }
    } catch (e) {
      setError('Failed to load playlist');
    }
    setLoadingPlaylist(null);
  };

  if (loading) {
    return (
      <Section>
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>
          <div style={{ fontSize: '12px' }}>Loading playlists...</div>
        </div>
      </Section>
    );
  }

  if (playlists.length === 0 && !error) {
    return (
      <Section>
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>
          <div style={{ marginBottom: '8px' }}><FaMusic size={32} /></div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>No Playlists Found</div>
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            Create playlists on <strong>YouTube Music</strong> and they'll appear here.
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      {/* Search button — pinned at top */}
      <Focusable
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
          }}
          onClick={() => {
            Navigation.CloseSideMenus();
            Navigation.Navigate('/youtube-music-search');
          }}
        >
          <div style={{ width: '60px', height: '60px', flexShrink: 0, alignSelf: 'center', background: 'rgba(66, 133, 244, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4285f4' }}>
            <FaSearch size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0, padding: '.55rem 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Search</div>
            <div style={{ fontSize: '11px', color: 'var(--gpSystemLighterGrey)', marginTop: '2px' }}>Find songs to play</div>
          </div>
        </DialogButton>
      </Focusable>

      {error && (
        <div style={{ padding: '8px 12px', color: '#ff6b6b', fontSize: '12px' }}>{error}</div>
      )}
      {playlists.map((playlist) => {
        const isLiked = playlist.playlistId === 'LM';
        const isLoading = loadingPlaylist === playlist.playlistId;

        return (
          <Focusable
            key={playlist.playlistId}
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
              onClick={() => { if (!isLoading) void handlePlaylistClick(playlist.playlistId); }}
            >
              {/* Thumbnail */}
              <div style={{ width: '60px', height: '60px', flexShrink: 0, alignSelf: 'center', position: 'relative', background: isLiked ? 'rgba(255, 80, 80, 0.15)' : 'rgba(255,255,255,0.05)' }}>
                {isLiked ? (
                  <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff5050' }}>
                    <FaHeart size={22} />
                  </div>
                ) : playlist.thumbnail ? (
                  <img
                    src={playlist.thumbnail}
                    alt=""
                    style={{ width: '60px', height: '60px', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gpSystemLighterGrey)' }}>
                    <FaMusic size={18} />
                  </div>
                )}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0, padding: '.55rem 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontWeight: isLiked ? 'bold' : 'normal', fontSize: '13px', display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textOverflow: 'ellipsis' }}>
                    {isLoading ? 'Loading...' : playlist.title}
                  </span>
                </div>
                {playlist.count !== null && (
                  <div style={{ fontSize: '11px', color: 'var(--gpSystemLighterGrey)', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {playlist.count} tracks
                  </div>
                )}
              </div>
            </DialogButton>
          </Focusable>
        );
      })}
    </Section>
  );
};
