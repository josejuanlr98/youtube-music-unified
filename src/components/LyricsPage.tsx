import { DialogButton, Focusable, GamepadButton, Navigation, QuickAccessTab } from '@decky/ui';
import { useEffect, useRef, useState } from 'react';
import { FaArrowLeft, FaMusic } from 'react-icons/fa';
import { addTrackChangeListener, getCurrentTrack } from '../services/audioManager';
import { loadLyrics, type LyricsResult } from '../services/lyrics';
import { focusLyricsReader } from '../services/focus';

interface LyricsPanelProps {
  onBack?: () => void;
}

/** Lyrics is rendered inside the Decky panel so Steam's layout stays untouched. */
export const LyricsPanel = ({ onBack }: LyricsPanelProps) => {
  const [track, setTrack] = useState(getCurrentTrack);
  const [result, setResult] = useState<LyricsResult>({});
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => focusLyricsReader(scrollRef.current), []);
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

  const scroll = (direction: number, page = false) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ top: direction * (page ? Math.max(80, el.clientHeight * 0.75) : 64), behavior:'smooth' });
  };

  const leave = onBack ?? (() => Navigation.NavigateBack());
  return (
    <Focusable className="ytm-ui" flow-children="vertical"
      style={{ width:'100%', maxWidth:'100%', minWidth:0, height:'100%', minHeight:0, overflow:'hidden', boxSizing:'border-box', padding:'6px 4px 4px', display:'flex', flexDirection:'column', gap:8, background:'#101823' }}
      onCancelButton={event => { event.preventDefault(); event.stopPropagation(); leave(); }}
      onCancelActionDescription="Back to player"
      onButtonDown={event => {
        const button = event.detail.button;
        if (button === GamepadButton.BUMPER_LEFT || button === GamepadButton.BUMPER_RIGHT) {
          event.preventDefault(); event.stopPropagation();
          scroll(button === GamepadButton.BUMPER_LEFT ? -1 : 1, true);
        }
      }}>
      <div style={{ display:'flex', flexShrink:0, alignItems:'center', justifyContent:'space-between', gap:8, minWidth:0 }}>
        <div style={{ minWidth:0 }}><div className="ytm-eyebrow">Lyrics</div><div style={{ margin:'2px 0 0', fontSize:15, fontWeight:700 }}>Now playing</div></div>
        <DialogButton className="ytm-button" style={{ width:72, minWidth:0, height:28, minHeight:28, padding:'0 8px', lineHeight:'28px', margin:0, fontSize:11 }} onClick={leave}><FaArrowLeft /> Back</DialogButton>
      </div>
      <div className="ytm-lyrics-layout" style={{ display:'flex', flexDirection:'row', gap:10, flex:1, minHeight:0, minWidth:0, overflow:'hidden' }}>
        <div style={{ width:78, minWidth:78, maxWidth:78, flex:'0 0 78px', overflow:'hidden' }}>
          {track?.albumArt ? <img src={track.albumArt} alt="Album art" style={{ width:78, height:78, maxWidth:78, maxHeight:78, objectFit:'cover', borderRadius:9 }} />
            : <div className="ytm-card" style={{ width:78, height:78, display:'grid', placeItems:'center' }}><FaMusic size={26} /></div>}
          <h2 style={{ fontSize:12, lineHeight:1.3, margin:'8px 0 4px', overflowWrap:'anywhere', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{track?.title ?? 'Nothing playing'}</h2>
          <div className="ytm-muted" style={{ fontSize:10, lineHeight:1.35, overflowWrap:'anywhere' }}>{track?.artist || 'Play a song to see its lyrics.'}</div>
          {result.source && <div className="ytm-hint" style={{ marginTop:10, fontSize:9, overflowWrap:'anywhere' }}>{result.source}</div>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, flex:'1 1 0', minHeight:0, minWidth:0, overflow:'hidden' }}>
          <Focusable ref={scrollRef} preferredFocus tabIndex={0} focusClassName="gpfocus"
            className="ytm-reader ytm-card" role="region" aria-label="Song lyrics"
            onGamepadDirection={event => {
              const button = event.detail.button;
              if (button === GamepadButton.DIR_UP || button === GamepadButton.DIR_DOWN) {
                event.preventDefault(); event.stopPropagation(); scroll(button === GamepadButton.DIR_UP ? -1 : 1);
              }
            }}
            onKeyDown={event => {
              if (['ArrowUp','ArrowDown','PageUp','PageDown'].includes(event.key)) {
                event.preventDefault(); scroll(event.key.endsWith('Up') ? -1 : 1, event.key.startsWith('Page'));
              }
            }}
            style={{ flex:'1 1 0', minHeight:0, boxSizing:'border-box', padding:'10px 12px', overflowY:'scroll', overscrollBehavior:'contain', scrollBehavior:'smooth', fontSize:14, lineHeight:1.55, whiteSpace:'pre-wrap', overflowWrap:'anywhere' }}>
            {loading ? <span className="ytm-muted">Loading lyrics…</span>
              : result.error ? <span style={{ color:'#ffc3cb' }}>{result.error}</span>
              : result.lyrics || (track ? 'Lyrics not available' : 'Your next song starts here.')}
          </Focusable>
          {result.error && <Focusable flow-children="horizontal" style={{ display:'flex', flexShrink:0, justifyContent:'center', minWidth:0 }}>
            <DialogButton className="ytm-button" style={{ width:96, minWidth:0, height:32, minHeight:32, padding:'0 8px', margin:0, lineHeight:'32px', fontSize:12 }} onClick={() => setAttempt(value => value + 1)}>Retry</DialogButton>
          </Focusable>}
          <div className="ytm-hint" style={{ fontSize:10, textAlign:'center', width:'100%', display:'flex', justifyContent:'center', flexWrap:'wrap', gap:'4px 8px' }}>
            <span><span className="ytm-key">L1</span> Up</span>
            <span><span className="ytm-key">R1</span> Down</span>
          </div>
        </div>
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
