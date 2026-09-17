import { DialogButton, Focusable } from '@decky/ui';
import { call } from '@decky/api';
import { useEffect, useState } from 'react';
import { FaPause, FaRandom, FaMusic, FaStop, FaAlignLeft } from 'react-icons/fa';
import { IoPlay, IoPlaySkipBack, IoPlaySkipForward } from 'react-icons/io5';
import { MdRepeat, MdRepeatOne, MdCastConnected } from 'react-icons/md';
import { AiOutlineLike, AiFillLike, AiOutlineDislike, AiFillDislike } from 'react-icons/ai';
import { usePlayer } from '../context/PlayerContext';
import { togglePlayback, playNext, playPrevious, stopAllPlayback, seekPlayback } from '../services/audioManager';
import { VolumeSlider, PaddedSlider } from './VolumeSlider';
import { LyricsPanel } from './LyricsPage';

const button: React.CSSProperties = { flex:'1 1 0', width:0, minWidth:0, minHeight:28, maxHeight:34, height:30, boxSizing:'border-box', lineHeight:'normal', fontSize:12, padding:'0 8px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, margin:0 };
const formatTime = (value: number) => { const total = Math.max(0, Math.floor(value || 0)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };

export const PlayerView = () => {
  const { track, isPlaying, shuffle, repeat, castConnected, castSenderName, position, duration, updateState } = usePlayer();
  const [rating, setRating] = useState('INDIFFERENT');
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  const [showLyrics, setShowLyrics] = useState(false);
  useEffect(() => {
    let alive = true;
    setRating('INDIFFERENT');
    if (track?.videoId) void call<[string], { rating: string }>('get_song_rating', track.videoId)
      .then(result => { if (alive) setRating(result.rating); }).catch(() => {});
    return () => { alive = false; };
  }, [track?.videoId]);

  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try { await action(); } catch { setError('Could not complete this action. Please try again.'); }
  };
  const rate = async (value: string) => {
    if (!track) return;
    const result = await call<[string, string], { rating?: string; error?: string }>('rate_song', track.videoId, rating === value ? 'INDIFFERENT' : value);
    if (result.error) throw new Error(result.error);
    if (result.rating) setRating(result.rating);
  };
  const stop = async () => {
    setStopping(true); setError('');
    try { await stopAllPlayback(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not finish stopping playback. Please try again.'); }
    finally { setStopping(false); }
  };
  const total = duration || track?.duration || 0;

  if (showLyrics) return <LyricsPanel onBack={() => setShowLyrics(false)} />;

  return (
    <div className="ytm-ui ytm-player-view" style={{ width:'100%', maxWidth:'100%', minWidth:0, minHeight:0, boxSizing:'border-box', padding:'2px 2px 6px', display:'flex', flexDirection:'column', gap:6 }}>
      <div className="ytm-card" style={{ padding:'10px 10px 12px', flexShrink:0, minWidth:0 }}>
        <div className="ytm-eyebrow" style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:2, marginBottom:12, width:'100%' }}>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {castConnected && <MdCastConnected size={13} />}
            {castConnected ? 'Cast connected' : isPlaying ? 'Now playing' : track ? 'Ready to play' : 'Your music, on Deck'}
          </div>
          {castConnected && castSenderName && <div className="ytm-muted" style={{ fontSize:10, fontWeight:500, letterSpacing:0, textTransform:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%' }}>From {castSenderName}</div>}
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'center', minWidth:0 }}>
          {track?.albumArt ? <img src={track.albumArt} alt="Album art" style={{ width:'clamp(52px, 15vw, 64px)', height:'clamp(52px, 15vw, 64px)', borderRadius:9, objectFit:'cover', flexShrink:0 }} />
            : <div style={{ width:'clamp(52px, 15vw, 64px)', height:'clamp(52px, 15vw, 64px)', borderRadius:9, background:'#344052', display:'grid', placeItems:'center', flexShrink:0 }}><FaMusic size={28} /></div>}
          <div style={{ minWidth:0, maxWidth:'calc(100% - 74px)', textAlign:'center' }}>
            <div style={{ fontSize:13, fontWeight:700, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{track?.title ?? 'Nothing playing'}</div>
            <div className="ytm-muted" style={{ fontSize:12, marginTop:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{track?.artist || 'Find a song in Library'}</div>
          </div>
        </div>
      </div>

      <div style={{ margin:0, minWidth:0 }}>
        <PaddedSlider value={Math.min(position, total)} min={0} max={Math.max(total, 1)} step={1} minimumDpadGranularity={5} showValue={false} disabled={!track || !total} onChange={seekPlayback} />
        <div className="ytm-muted" style={{ display:'flex', justifyContent:'space-between', padding:'0 2px', fontSize:10, fontVariantNumeric:'tabular-nums' }}><span>{formatTime(position)}</span><span>{formatTime(total)}</span></div>
      </div>

      <Focusable flow-children="horizontal" style={{ display:'flex', gap:6, minWidth:0, flexShrink:0 }}>
        <DialogButton className="ytm-button" style={{ ...button, height:34 }} disabled={!track || stopping} onOKActionDescription="Previous" onClick={() => void run(playPrevious)}><IoPlaySkipBack size={19} /></DialogButton>
        <DialogButton className="ytm-button ytm-primary" style={{ ...button, flex:1.35, height:34 }} disabled={!track || stopping} onOKActionDescription={isPlaying ? 'Pause' : 'Play'} onClick={togglePlayback}>{isPlaying ? <FaPause size={18} /> : <IoPlay size={22} />}</DialogButton>
        <DialogButton className="ytm-button" style={{ ...button, height:34 }} disabled={!track || stopping} onOKActionDescription="Next" onClick={() => void run(playNext)}><IoPlaySkipForward size={19} /></DialogButton>
      </Focusable>

      <Focusable flow-children="horizontal" style={{ display:'flex', gap:6, minWidth:0, flexShrink:0 }}>
        <DialogButton className={`ytm-button ${rating === 'LIKE' ? 'ytm-selected' : ''}`} style={button} disabled={!track} onOKActionDescription="Like" onClick={() => void run(() => rate('LIKE'))}>{rating === 'LIKE' ? <AiFillLike size={18} /> : <AiOutlineLike size={18} />}</DialogButton>
        <DialogButton className={`ytm-button ${rating === 'DISLIKE' ? 'ytm-selected' : ''}`} style={button} disabled={!track} onOKActionDescription="Dislike" onClick={() => void run(() => rate('DISLIKE'))}>{rating === 'DISLIKE' ? <AiFillDislike size={18} /> : <AiOutlineDislike size={18} />}</DialogButton>
        <DialogButton className="ytm-button" style={{ ...button, flex:1.6 }} disabled={!track} onClick={() => setShowLyrics(true)}><FaAlignLeft size={14} /> Lyrics</DialogButton>
      </Focusable>

      <div style={{ margin:0, minWidth:0 }}><VolumeSlider /></div>

      <Focusable flow-children="horizontal" style={{ display:'flex', gap:6, minWidth:0, flexShrink:0 }}>
        <DialogButton className={`ytm-button ${shuffle ? 'ytm-selected' : ''}`} style={{ ...button, fontSize:11 }} disabled={castConnected} onClick={() => void run(async () => { const result = await call<[], { shuffle: boolean }>('toggle_shuffle'); updateState({ shuffle:result.shuffle }); })}><FaRandom /> Shuffle {shuffle ? 'On' : 'Off'}</DialogButton>
        <DialogButton className={`ytm-button ${repeat !== 'NONE' ? 'ytm-selected' : ''}`} style={{ ...button, fontSize:11 }} disabled={castConnected} onClick={() => void run(async () => { const result = await call<[], { repeat:'NONE' | 'ALL' | 'ONE' }>('toggle_repeat'); updateState({ repeat:result.repeat }); })}>{repeat === 'ONE' ? <MdRepeatOne size={17} /> : <MdRepeat size={17} />} Repeat {repeat === 'NONE' ? 'Off' : repeat === 'ONE' ? 'One' : 'All'}</DialogButton>
      </Focusable>
      {castConnected && <div className="ytm-muted" style={{ fontSize:10, textAlign:'center' }}>Shuffle / repeat: use your device.</div>}
      <DialogButton className="ytm-button" style={{ ...button, flex:'none', width:'100%', fontSize:12 }} disabled={stopping} onClick={() => void stop()}><FaStop size={11} /> {stopping ? 'Stopping & unlinking…' : 'Stop, Clear & Unlink'}</DialogButton>
      {error && <div className="ytm-error" role="alert">{error}</div>}
    </div>
  );
};
