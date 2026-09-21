import { DialogButton, Focusable, GamepadButton, Navigation, QuickAccessTab } from '@decky/ui';
import { useEffect, useRef, useState } from 'react';
import { FaArrowLeft, FaExpand } from 'react-icons/fa';
import { addTrackChangeListener, getCurrentTrack, addCastConnectionListener, getIsCastConnected, getCastSenderName } from '../services/audioManager';
import { loadLyrics, type LyricsResult } from '../services/lyrics';
import { focusLyricsReader } from '../services/focus';

import { MdCastConnected } from 'react-icons/md';
import { SiYoutubemusic } from 'react-icons/si';
import { startLyricsScroll } from '../services/lyricsScroll';
import { suppressFullscreenNotifications } from '../services/notifications';

export const LYRICS_ROUTE = '/youtube-music-lyrics';

interface LyricsPanelProps {
  onBack?: () => void;
  fullScreen?: boolean;
}

/**
 * A compact lyrics reader for Quick Access and a larger reader for the
 * dedicated route. The two views share the same data and gamepad controls.
 */
export const LyricsPanel = ({ onBack, fullScreen = false }: LyricsPanelProps) => {
  const [track, setTrack] = useState(getCurrentTrack);
  const [cast, setCast] = useState(() => ({ connected:getIsCastConnected(), sender:getCastSenderName() }));
  const [result, setResult] = useState<LyricsResult>({});
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const exitRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef<ReturnType<typeof startLyricsScroll> | null>(null);
  useEffect(() => focusLyricsReader(fullScreen ? exitRef.current : scrollRef.current), [fullScreen]);
  useEffect(() => addTrackChangeListener(setTrack), []);

  useEffect(() => {
    let alive = true;
    setResult({});
    setLoading(!!track?.videoId);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (track?.videoId) {
      void loadLyrics(track.videoId).then(value => { if (alive) setResult(value); })
        .catch(() => { if (alive) setResult({ error: 'Could not load lyrics. Please try again.' }); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [track?.videoId, attempt]);

  // Deck exposes this store in SteamOS. BlockSuspendAction prevents the Deck
  // from suspending while the dedicated reader is open; the browser wake lock
  // covers displays/firmware that support that API. Both are released on exit.
  useEffect(() => {
    if (!fullScreen) return;
    let releaseSuspend: (() => void) | undefined;
    let wakeLock: WakeLockSentinel | undefined;
    let pending = false;
    let disposed = false;
    try {
      const store = (window as unknown as { SuspendResumeStore?: { BlockSuspendAction?: () => (() => void) } }).SuspendResumeStore;
      if (typeof store?.BlockSuspendAction === 'function') releaseSuspend = store.BlockSuspendAction();
    } catch { /* Deck builds without this store simply use the wake lock. */ }
    const acquireWakeLock = async () => {
      if (disposed || pending || document.visibilityState !== 'visible' || (wakeLock && !wakeLock.released)) return;
      pending = true;
      try {
        if (navigator.wakeLock?.request) {
          const acquired = await navigator.wakeLock.request('screen');
          if (disposed) await acquired.release();
          else wakeLock = acquired;
        }
      } catch { /* Wake lock is optional; BlockSuspendAction is still active. */ }
      finally { pending = false; }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') void acquireWakeLock(); };
    document.addEventListener('visibilitychange', onVisibility);
    void acquireWakeLock();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      try { releaseSuspend?.(); } catch { /* already released by Steam */ }
      void wakeLock?.release().catch(() => {});
    };
  }, [fullScreen]);

  useEffect(() => fullScreen ? suppressFullscreenNotifications() : undefined, [fullScreen]);
  useEffect(() => addCastConnectionListener((connected, sender) => setCast({ connected, sender })), []);
  useEffect(() => {
    if (!fullScreen || loading || !result.lyrics || !scrollRef.current) return;
    const motion = startLyricsScroll(scrollRef.current);
    autoScroll.current = motion;
    return () => { motion.dispose(); autoScroll.current = null; };
  }, [fullScreen, loading, result.lyrics, track?.videoId]);
  const centered = fullScreen && (!track || (!loading && !result.lyrics && !result.error));
  const pauseMotion = () => autoScroll.current?.pause();

  const scroll = (direction: number, page = false) => {
    pauseMotion();
    const el = scrollRef.current;
    if (el) el.scrollBy({ top: direction * (page ? Math.max(80, el.clientHeight * 0.75) : 64), behavior: 'smooth' });
  };

  const leaving = useRef(false);
  const artwork = (() => {
    const original = track?.albumArt || '';
    if (!fullScreen) return original;
    try {
      const url = new URL(original);
      if (url.hostname.endsWith('.googleusercontent.com') || url.hostname.endsWith('.ggpht.com'))
        return original.replace(/=w\d+-h\d+[^?]*/, '=w800-h800-l90-rj');
    } catch {}
    return original;
  })();
  const leave = onBack ?? (() => {
    if (leaving.current) return;
    leaving.current = true;
    Navigation.NavigateBack();
    if (fullScreen) {
      window.dispatchEvent(new Event('ytm-return-player'));
      setTimeout(() => Navigation.OpenQuickAccessMenu(QuickAccessTab.Decky), 200);
    }
  });
  const openFullscreen = () => { Navigation.CloseSideMenus(); Navigation.Navigate(LYRICS_ROUTE); };
  const rootStyle = fullScreen
    ? { width: '100%', maxWidth: '100%', minWidth: 0, top: 40, bottom: 40, left: 0, right: 0, minHeight: 0, overflow: 'hidden', boxSizing: 'border-box' as const, padding: 'clamp(16px, 3vw, 42px)', display: 'flex', flexDirection: 'column' as const, gap: 16, background: '#080b11', position: 'fixed' as const }
    : { width: '100%', maxWidth: '100%', minWidth: 0, height: '100%', minHeight: 0, overflow: 'hidden', boxSizing: 'border-box' as const, padding: '6px 4px 4px', display: 'flex', flexDirection: 'column' as const, gap: 8, background: '#101823' };
  const readerStyle = fullScreen
    ? { flex: '1 1 0', minHeight: 0, boxSizing: 'border-box' as const, padding: 'clamp(14px, 2.5vw, 32px)', overflowY: 'scroll' as const, overscrollBehavior: 'contain' as const, scrollBehavior: 'auto' as const, textAlign: 'center' as const, fontSize: 'clamp(15px, 1.65vw, 24px)', lineHeight: 1.65, whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const }
    : { flex: '1 1 0', minHeight: 0, boxSizing: 'border-box' as const, padding: '10px 12px', overflowY: 'scroll' as const, overscrollBehavior: 'contain' as const, scrollBehavior: 'smooth' as const, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const };

  const lyricsContent = loading
    ? <span className="ytm-muted">Loading lyrics…</span>
    : result.error
      ? <span style={{ color: '#ffc3cb' }}>{result.error}</span>
      : result.lyrics || (track ? 'Lyrics not available' : 'Your next song starts here.');

  return (
    <Focusable className="ytm-ui" flow-children="vertical"
      style={rootStyle}
      onCancelButton={event => { event.preventDefault(); event.stopPropagation(); leave(); }}
      onSecondaryActionDescription={!fullScreen ? 'Fullscreen' : undefined}
      onSecondaryButton={!fullScreen ? event => { event.preventDefault(); event.stopPropagation(); openFullscreen(); } : undefined}
      onCancelActionDescription="Back to player"
      onButtonDown={event => {
        const button = event.detail.button;
        if (button === GamepadButton.BUMPER_LEFT || button === GamepadButton.BUMPER_RIGHT) {
          event.preventDefault(); event.stopPropagation();
          scroll(button === GamepadButton.BUMPER_LEFT ? -1 : 1, true);
        }
      }}>
      {fullScreen && track?.albumArt && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${track.albumArt})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(32px)', opacity: .16, transform: 'scale(1.12)' }} />}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexShrink: 0, minHeight:28, alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
        <div style={{ minWidth: 0, textAlign: fullScreen ? 'center' : 'left', flex: 1, padding: fullScreen ? '0 70px' : 0 }}>{!fullScreen && <div className="ytm-eyebrow">Lyrics</div>}<div style={{ margin: '2px 0 0', fontSize: fullScreen ? 20 : 15, fontWeight: 700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{!fullScreen && (track?.title || 'Now playing')}</div></div>
        {!fullScreen && <DialogButton className="ytm-button" aria-label="Fullscreen" onOKActionDescription="Fullscreen" style={{ width:32, flexShrink:0, minWidth:32, height:28, minHeight:28, padding:0, margin:0, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={openFullscreen}><FaExpand size={13} /></DialogButton>}
        <DialogButton ref={exitRef} preferredFocus={fullScreen} className="ytm-button" style={{ position:fullScreen ? 'absolute' : undefined, right:fullScreen ? 0 : undefined, background:fullScreen ? 'transparent' : undefined, borderColor:fullScreen ? 'transparent' : undefined, width: fullScreen ? 58 : 72, minWidth: 0, height: 28, minHeight: 28, padding: '0 8px', lineHeight: '28px', margin: 0, fontSize: 11 }} onClick={leave}><FaArrowLeft /> {fullScreen ? 'Exit' : 'Back'}</DialogButton>
      </div>
      <div className="ytm-lyrics-layout" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'row', gap: fullScreen ? 'clamp(18px, 4vw, 54px)' : 10, flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', alignItems: fullScreen ? 'center' : 'stretch', justifyContent:fullScreen ? 'center' : undefined, maxWidth:fullScreen ? 860 : undefined, width:'100%', margin:fullScreen ? '0 auto' : undefined }}>
        <div style={{ width: fullScreen ? 'min(26vw, 260px, calc(100vh - 260px))' : 78, minWidth: fullScreen ? 100 : 78, maxWidth: fullScreen ? (centered ? '80%' : '30%') : 78, flex: '0 0 auto', overflow: 'hidden', textAlign: fullScreen ? 'center' : 'left' }}>
          {fullScreen && cast.connected && <div className="ytm-muted" style={{ textAlign:'center', fontSize:12, lineHeight:1.4, marginBottom:12, overflowWrap:'anywhere' }}>
            <MdCastConnected size={14} style={{ verticalAlign:'middle', marginRight:6 }} />{cast.sender ? `Casting from ${cast.sender}` : 'Casting from your device'}
          </div>}
          {track?.albumArt ? <img src={artwork} onError={event => { if (event.currentTarget.src !== track.albumArt) event.currentTarget.src = track.albumArt; }} alt="Album art" style={{ width: fullScreen ? '100%' : 78, height: fullScreen ? 'min(26vw, 260px, calc(100vh - 260px))' : 78, aspectRatio: '1', display: 'block', maxWidth: '100%', objectFit: 'cover', borderRadius: fullScreen ? 16 : 9, boxShadow: fullScreen ? '0 18px 48px rgba(0,0,0,.4)' : undefined }} />
            : <div className="ytm-card" style={{ width: '100%', aspectRatio: '1', display: 'grid', placeItems: 'center' }}><SiYoutubemusic size={fullScreen ? 84 : 26} /></div>}
          <h2 style={{ fontSize: fullScreen ? 16 : 12, lineHeight: 1.3, margin: fullScreen ? '14px 0 4px' : '8px 0 4px', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{track?.title ?? 'Nothing playing'}</h2>
          <div className="ytm-muted" style={{ fontSize: fullScreen ? 13 : 10, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{track?.artist || 'Play a song to see its lyrics.'}</div>

          {result.source && <div className="ytm-hint" style={{ marginTop: 10, fontSize: 9, overflowWrap: 'anywhere' }}>{result.source}</div>}
        </div>
        {!centered && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 0', maxWidth:fullScreen ? 620 : undefined, alignSelf: 'stretch', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          <Focusable ref={scrollRef} preferredFocus={!fullScreen} tabIndex={0} onWheel={pauseMotion} onTouchStart={pauseMotion} onTouchMove={pauseMotion} onPointerDown={pauseMotion} focusClassName="gpfocus"
            className="ytm-reader ytm-card" role="region" aria-label="Song lyrics"
            onGamepadDirection={event => {
              const button = event.detail.button;
              if (button === GamepadButton.DIR_UP || button === GamepadButton.DIR_DOWN) {
                event.preventDefault(); event.stopPropagation(); scroll(button === GamepadButton.DIR_UP ? -1 : 1);
              }
            }}
            onKeyDown={event => {
              if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key)) {
                event.preventDefault(); scroll(event.key.endsWith('Up') ? -1 : 1, event.key.startsWith('Page'));
              }
            }}
            style={readerStyle}>
            {lyricsContent}
          </Focusable>
          {result.error && <Focusable flow-children="horizontal" style={{ display: 'flex', flexShrink: 0, justifyContent: 'center', minWidth: 0 }}>
            <DialogButton className="ytm-button" style={{ width: 96, minWidth: 0, height: 32, minHeight: 32, padding: '0 8px', margin: 0, lineHeight: '32px', fontSize: 12 }} onClick={() => setAttempt(value => value + 1)}>Retry</DialogButton>
          </Focusable>}
          {!fullScreen && <div className="ytm-hint" style={{ fontSize: fullScreen ? 12 : 10, textAlign: 'center', width: '100%', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px 8px' }}>
            <span><span className="ytm-key">L1</span> Up</span>
            <span><span className="ytm-key">R1</span> Down</span>
          </div>}
        </div>}
      </div>
    </Focusable>
  );
};

// Kept for compatibility with old route registrations and external callers.
export const LyricsPage = () => {
  let returning = false;
  const back = () => {
    if (returning) return;
    returning = true;
    Navigation.NavigateBack();
    setTimeout(() => { returning = false; Navigation.OpenQuickAccessMenu(QuickAccessTab.Decky); }, 180);
  };
  return <LyricsPanel onBack={back} />;
};
