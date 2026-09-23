import { useLayoutEffect, useRef } from 'react';
import { themeCss } from '../theme';

// Steam may render Quick Access and routes in a different document from the
// plugin entry point. Install in the mounted view's document, not global document.
const documents = new WeakMap<Document, { style: HTMLStyleElement; users: number }>();
export function attachViewTheme(doc: Document) {
  let entry = documents.get(doc);
  if (!entry) {
    const style = doc.createElement('style');
    style.dataset.ytmViewTheme = 'true';
    style.style.setProperty('display', 'none', 'important');
    style.textContent = themeCss;
    doc.head.appendChild(style);
    entry = { style, users: 0 };
    documents.set(doc, entry);
  }
  entry.users++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--entry.users === 0) { entry.style.remove(); documents.delete(doc); }
  };
}

export function ThemeScope() {
  const anchor = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const doc = anchor.current?.ownerDocument;
    return doc ? attachViewTheme(doc) : undefined;
  }, []);
  return <span ref={anchor} hidden aria-hidden="true" style={{ display:'none' }} />;
}
