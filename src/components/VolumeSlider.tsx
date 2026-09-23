import { SliderField } from '@decky/ui';
import type { SliderFieldProps } from '@decky/ui';
import { call } from '@decky/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FaVolumeUp } from 'react-icons/fa';
import { setAudioVolume, getAudioElement } from '../services/audioManager';

// Module-level cache — survives tab switches (component remounts)
let cachedVolume: number | null = null;

// Keep Decky's SliderField so left/right on the gamepad changes the value.
// The wrapper only removes the stock Quick Access minimum width and padding.
export const PaddedSlider = (props: SliderFieldProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const firstChild = ref.current.firstElementChild as HTMLElement | null;
    if (firstChild) {
      firstChild.style.paddingLeft = '19px';
      firstChild.style.paddingRight = '19px';
    }
    ref.current.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (parseFloat(window.getComputedStyle(el).minWidth) >= 270) el.style.minWidth = '0';
    });
  }, []);
  return <div ref={ref} className="ytm-compact-slider" style={{ width:'100%', minWidth:0, maxWidth:'100%', borderRadius:8 }}>
    <SliderField {...props} />
  </div>;
};

export const VolumeSlider = () => {
  const [displayVolume, setDisplayVolume] = useState<number>(cachedVolume ?? 100);
  const apiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch volume from backend on mount (if no cached value)
  useEffect(() => {
    if (cachedVolume !== null) return;
    void (async () => {
      try {
        const result = await call<[], { volume: number }>('get_volume');
        const vol = result.volume;
        cachedVolume = vol;
        setDisplayVolume(vol);
        setAudioVolume(vol); // sync <audio> element
      } catch (e) {
        console.error('[YTM] Failed to fetch volume:', e);
      }
    })();
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (apiDebounceRef.current) clearTimeout(apiDebounceRef.current);
    };
  }, []);

  const handleChange = useCallback((val: number) => {
    setDisplayVolume(val);
    cachedVolume = val;

    // Set <audio> volume immediately for instant response
    const audio = getAudioElement();
    if (audio) audio.volume = Math.max(0, Math.min(1, val / 100));

    // Debounce the backend + PulseAudio call
    if (apiDebounceRef.current) clearTimeout(apiDebounceRef.current);
    apiDebounceRef.current = setTimeout(() => {
      void setAudioVolume(val);
    }, 300);
  }, []);

  return (
    <PaddedSlider
      icon={<FaVolumeUp size={18} />}
      value={displayVolume}
      min={0}
      max={100}
      step={1}
      onChange={handleChange}
      showValue={false}
    />
  );
};
