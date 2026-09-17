import { DialogButton, Field, Focusable } from '@decky/ui';
import { call } from '@decky/api';
import { useEffect, useRef, useState } from 'react';
import { FaMusic } from 'react-icons/fa';
import { IoVolumeMedium } from 'react-icons/io5';
import { MdSwapVert, MdPlaylistPlay, MdArrowUpward, MdArrowDownward, MdDone } from 'react-icons/md';
import { playTrack, type TrackInfo, getIsCastConnected, getQueue, addQueueListener, addTrackChangeListener } from '../services/audioManager';
import { Section } from './Section';
import { usePlayer } from '../context/PlayerContext';

export const QueueView = () => {
  const { updateState } = usePlayer();
  const [queue, setQueue] = useState<TrackInfo[]>([]);
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const actionButton: React.CSSProperties = { width:30, minWidth:0, height:60, minHeight:60, maxHeight:60, padding:0, margin:0, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' };

  const edit = async (index: number, action: 'up' | 'down' | 'next') => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const expectedIds = queue.map(t => t.videoId);
      if (getIsCastConnected()) {
        const response = await fetch('http://127.0.0.1:39281/api/queue/edit', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ index, action, expectedIds }) });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || result.error || 'Could not update Cast queue.');
        setQueue(result.tracks); setPosition(result.position);
      } else {
        const result = await call<[number, string, string[]], { success?:boolean; error?:string; tracks:TrackInfo[]; position:number; repeat:'NONE' | 'ALL' | 'ONE' }>('edit_queue', index, action, expectedIds);
        if (!result.success) throw new Error(result.error || 'Could not update queue.');
        setQueue(result.tracks); setPosition(result.position);
        updateState({ repeat:result.repeat });
      }
      setMoving(action === 'up' ? index - 1 : action === 'down' ? index + 1 : null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update queue.'); setMoving(null); await loadQueue(true); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const loadQueue = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (getIsCastConnected()) {
        const response = await fetch('http://127.0.0.1:39281/api/queue');
        if (!response.ok) throw new Error('Could not load Cast queue');
        const data = await response.json();
        setQueue(data.tracks ?? []); setPosition(data.position ?? -1);
        setLoading(false); return;
      }
      const data = await call<[], { tracks: TrackInfo[]; position: number }>('get_queue');
      setQueue(data.tracks ?? []);
      setPosition(data.position ?? 0);
    } catch (e) {
      console.error('[YTM] Failed to load queue:', e);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    const initial = getQueue();
    if (getIsCastConnected() && initial.tracks.length) {
      setQueue(initial.tracks);
      setPosition(initial.position);
      setLoading(false);
    } else {
      void loadQueue();
    }
    const removeTrack = addTrackChangeListener(() => { if (!getIsCastConnected() && !inFlight.current) void loadQueue(true); });
    const removeQueue = addQueueListener((tracks, pos) => {
      if (getIsCastConnected() || tracks.length === 0) {
        if (!inFlight.current) setMoving(null);
        setQueue(tracks);
        setPosition(pos);
        setLoading(false);
      }
    });
    return () => { removeTrack(); removeQueue(); };
  }, []);

  const handleJump = async (index: number) => {
    if (inFlight.current) return;
    try {
      if (getIsCastConnected()) {
        const target = queue[index];
        if (!target) return;
        await fetch('http://127.0.0.1:39281/api/queue/jump', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: target.videoId }) });
        return;
      }
      const result = await call<[number], TrackInfo & { error?: string }>('jump_to_queue', index);
      if (!result.error && result.url) {
        await playTrack(result as TrackInfo);
      }
      void loadQueue(true);
    } catch (e) {
      console.error('[YTM] Jump to queue failed:', e);
    }
  };

  const handleRemove = async (index: number) => {
    if (inFlight.current) return;
    setError('');
    try {
      if (getIsCastConnected()) {
        const target = queue[index];
        if (!target) return;
        const response = await fetch('http://127.0.0.1:39281/api/queue/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: target.videoId }) });
        const result = await response.json();
        if (!result.ok) throw new Error(result.message || 'Could not remove song');
      } else {
        await call<[number], { success?: boolean }>('remove_from_queue', index);
      }
      void loadQueue(true);
    } catch (e) {
      console.error('[YTM] Remove from queue failed:', e);
      setError(e instanceof Error ? e.message : 'Could not remove song');
    }
  };

  if (loading) {
    return (
      <Section>
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>
          <div style={{ fontSize: '12px' }}>Loading queue...</div>
        </div>
      </Section>
    );
  }

  if (queue.length === 0) {
    return (
      <Section>
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--gpSystemLighterGrey)' }}>
          <div style={{ marginBottom: '8px' }}><FaMusic size={32} /></div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Queue is Empty</div>
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            Load a playlist from the <strong>Library</strong> tab or use <strong>Search</strong> to find a song.
          </div>
        </div>
      </Section>
    );
  }

  const occurrences = new Map<string, number>();
  return (
    <Section>
      {error && <div role="alert" className="ytm-error">{error}</div>}
      {queue.map((track, index) => {
        const occurrence = occurrences.get(track.videoId) ?? 0;
        occurrences.set(track.videoId, occurrence + 1);
        const title = track.title ?? 'Unknown';
        const artist = track.artist ?? '';
        const isSelected = index === position;
        const thumbnail = track.albumArt;

        if (DialogButton) {
          return (
            <Focusable
              key={`${track.videoId}-${occurrence}`}
              style={{ display: 'flex', alignItems: 'stretch', height:'60px', minHeight:'60px', maxHeight:'60px', overflow:'hidden', marginTop: '2px', marginBottom: '2px' }}
              flow-children="horizontal"
            >
              {moving === index ? <>
                <div style={{ flex:1, minWidth:0, padding:'6px', fontSize:11, alignSelf:'center' }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div><div className="ytm-muted">Position {index + 1} of {queue.length}</div></div>
                <DialogButton className="ytm-button" style={actionButton} disabled={busy || index === 0} onOKActionDescription="Move up" aria-label="Move up" onClick={() => void edit(index, 'up')}><MdArrowUpward /></DialogButton>
                <DialogButton className="ytm-button" style={actionButton} disabled={busy || index === queue.length - 1} onOKActionDescription="Move down" aria-label="Move down" onClick={() => void edit(index, 'down')}><MdArrowDownward /></DialogButton>
                <DialogButton className="ytm-button" style={actionButton} disabled={busy} onOKActionDescription="Done" aria-label="Done" onClick={() => setMoving(null)}><MdDone /></DialogButton>
              </> : <><DialogButton
                className={`ytm-button ytm-list-row ${isSelected ? "ytm-selected" : ""}`}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  height: '60px',
                  minHeight: '60px',
                  maxHeight: '60px',
                  padding: '0',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  borderRadius: '8px',
                  margin: '0',
                  overflow: 'hidden',
                }}
                onClick={() => { void handleJump(index); }}
                disabled={busy}
              >
                {/* Thumbnail */}
                <div style={{ width: '60px', height: '60px', flexShrink: 0, alignSelf: 'center', position: 'relative', background: 'rgba(255,255,255,0.05)' }}>
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      style={{ width: '60px', height: '60px', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gpSystemLighterGrey)' }}>
                      <FaMusic size={18} />
                    </div>
                  )}
                  {isSelected && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IoVolumeMedium size={20} color="white" />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0, padding: '.55rem 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontWeight: isSelected ? 'bold' : 'normal', fontSize: '13px', display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textOverflow: 'ellipsis' }}>{title}</span>
                  </div>
                  {artist && (
                    <div style={{ fontSize: '11px', color: 'var(--gpSystemLighterGrey)', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {artist}
                    </div>
                  )}
                </div>
              </DialogButton>
              <DialogButton className="ytm-button" style={actionButton} disabled={busy || queue.length < 2} onOKActionDescription="Move song" aria-label="Move song" onClick={() => { setError(''); setMoving(index); }}><MdSwapVert size={19} /></DialogButton>
              <DialogButton className="ytm-button" style={actionButton} disabled={busy || isSelected || position < 0} onOKActionDescription="Play next" aria-label="Play next" onClick={() => void edit(index, 'next')}><MdPlaylistPlay size={19} /></DialogButton>
              <DialogButton
                className={`ytm-button ytm-list-row ${isSelected ? "ytm-selected" : ""}`}
                onClick={() => { void handleRemove(index); }}
                disabled={busy || getIsCastConnected()}
                onOKActionDescription="Remove song"
                aria-label="Remove song"
                style={{
                  width: '28px',
                  height: '60px',
                  maxHeight: '60px',
                  minWidth: '0',
                  padding: '0',
                  margin: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  borderRadius: '8px',
                  borderLeft: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                ✕
              </DialogButton>
              </>}
            </Focusable>
          );
        }

        // Fallback when DialogButton unavailable
        return (
          <Field
            key={track.videoId ?? `q-${index}`}
            label={<span style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>{title}</span>}
            description={artist || undefined}
            onActivate={() => { void handleJump(index); }}
            onClick={() => { void handleJump(index); }}
            highlightOnFocus
            focusable
            bottomSeparator="none"
          />
        );
      })}
    </Section>
  );
};
