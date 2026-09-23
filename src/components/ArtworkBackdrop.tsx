import { useEffect, useRef } from 'react';
import type { ArtworkPalette } from '../services/artworkPalette';
import { recordVisualDiagnostic } from '../services/visualDiagnostics';

/** CSS owns the animation in the rendered document (including Steam portals). */
export function startArtworkMotion(element: HTMLElement, reverse = false) {
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  const reduced = view?.matchMedia('(prefers-reduced-motion: reduce)');
  const style = doc.createElement('style');
  style.textContent = `@keyframes ytm-artwork-drift {
    from { transform:scale(1.12) translate(-9%, -5%) rotate(-6deg); }
    to { transform:scale(1.32) translate(9%, 6%) rotate(6deg); }
  }`;
  doc.head.appendChild(style);
  const update = () => {
    element.style.setProperty('animation', reduced?.matches ? 'none' : `ytm-artwork-drift ${reverse ? 26 : 18}s ease-in-out -5s infinite ${reverse ? 'alternate-reverse' : 'alternate'}`, 'important');
    recordVisualDiagnostic('Motion', reduced?.matches ? 'reduced motion enabled' : 'CSS drift started');
  };
  reduced?.addEventListener('change', update);
  update();
  // Observe real elapsed time, not a manually scrubbed animation. Two samples,
  // no permanent polling or per-frame React updates.
  let before = '';
  let beforeTime: number | null = null;
  const first = setTimeout(() => {
    before = view?.getComputedStyle(element).transform || '';
    beforeTime = Number(element.getAnimations?.()[0]?.currentTime ?? NaN);
  }, 500);
  const second = setTimeout(() => {
    const transform = view?.getComputedStyle(element).transform || '';
    const animation = element.getAnimations?.()[0];
    const advanced = Number(animation?.currentTime) > Number(beforeTime);
    recordVisualDiagnostic('Motion', `changed=${!!before && before !== transform}; clock=${advanced}; state=${animation?.playState || 'none'}; document=${doc.visibilityState}`);
  }, 2500);
  return () => {
    clearTimeout(first); clearTimeout(second);
    element.style.removeProperty('animation');
    style.remove();
    reduced?.removeEventListener('change', update);
  };
}

export function ArtworkBackdrop({ palette, animated = false }: { palette: ArtworkPalette; animated?: boolean }) {
  const artRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!animated || !artRef.current || !secondRef.current) return;
    const stopFirst = startArtworkMotion(artRef.current);
    const stopSecond = startArtworkMotion(secondRef.current, true);
    return () => { stopFirst(); stopSecond(); };
  }, [animated]);
  const [primary, secondary, tertiary] = palette;
  return <div className="ytm-atmosphere" aria-hidden="true" style={{ position:'absolute', inset:0, overflow:'hidden', zIndex:0, pointerEvents:'none', background:'#080b11' }}>
    <div ref={artRef} className="ytm-atmosphere-art"
      style={{ position:'absolute', inset:'-18%', filter:'none', opacity:.85, transform:'scale(1.12)',
        backgroundImage:`radial-gradient(ellipse at 22% 34%, rgba(${primary},.85), transparent 54%), radial-gradient(ellipse at 78% 72%, rgba(${secondary},.8), transparent 58%)` }} />
    <div ref={secondRef} className="ytm-atmosphere-flow"
      style={{ position:'absolute', inset:'-18%', opacity:.7, transform:'scale(1.12)',
        backgroundImage:`radial-gradient(ellipse at 72% 28%, rgba(${tertiary},.85), transparent 53%), radial-gradient(ellipse at 34% 78%, rgba(${primary},.5), transparent 57%)` }} />
    <div className="ytm-atmosphere-shade" style={{ position:'absolute', inset:0,
      background:'linear-gradient(90deg,rgba(5,8,14,.32),rgba(5,8,14,.58) 62%,rgba(5,8,14,.65)),radial-gradient(ellipse at 50% 50%,transparent 25%,rgba(5,8,14,.4))' }} />
  </div>;
}
