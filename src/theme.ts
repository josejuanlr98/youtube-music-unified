// Scoped theme; cover motion is limited to the mounted fullscreen reader.
export const themeCss = `
.ytm-ui { --ytm-accent:#ff0000; --ytm-focus:#66c0f4; --ytm-muted:#b2becd; color:#f4f6fa; width:100%; max-width:100%; min-width:0; box-sizing:border-box; }
.ytm-ui .ytm-card,.ytm-ui.ytm-card { background:linear-gradient(135deg,#202c3c,#18212e); border:1px solid #354052; border-radius:12px; }
.ytm-ui .ytm-eyebrow { color:var(--ytm-muted); font-size:10px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; }
.ytm-ui .ytm-muted { color:var(--ytm-muted); }
.ytm-ui .ytm-button { border:1px solid #3b485b; border-radius:8px !important; background:#273446; color:#f4f6fa; min-width:0 !important; max-width:100%; box-sizing:border-box; }
.ytm-ui .ytm-button:hover { background:#36465b; }
.ytm-ui .ytm-compact-slider.gpfocus,.ytm-ui .ytm-compact-slider:focus,.ytm-ui .ytm-button:focus,.ytm-ui .ytm-button.gpfocus { outline:2px solid var(--ytm-focus); outline-offset:2px; background-color:#35445a; color:#fff; }
.ytm-ui .ytm-compact-slider,.ytm-ui .ytm-compact-slider.gpfocus,.ytm-ui .ytm-compact-slider:focus,.ytm-ui .ytm-compact-slider > *,.ytm-ui .ytm-compact-slider *:focus,.ytm-ui .ytm-compact-slider .gpfocus { border-radius:8px !important; }
.ytm-ui .ytm-reader:focus,.ytm-ui .ytm-reader.gpfocus,.ytm-ui .ytm-reader-focus { outline:none !important; box-shadow:none !important; }
.ytm-ui .ytm-button:disabled { opacity:.4; }
.ytm-ui .ytm-primary { background:#ff0000; color:#fff; border-color:#ff5c5c; }
.ytm-ui .ytm-primary:hover { background:#d90000; }
.ytm-ui .ytm-selected { color:#ff8a8a; border-color:#a94747; }
.ytm-ui .ytm-error { padding:10px 12px; border:1px solid #9a5363; border-radius:8px; color:#ffc3cb; background:#3d2431; font-size:12px; line-height:1.45; }
.ytm-ui .ytm-list-row { border-radius:9px !important; margin:4px 6px; border:1px solid #334052; min-width:0 !important; max-width:100%; }
.ytm-ui .ytm-list-row img { border-radius:8px 0 0 8px; }
.ytm-ui button { min-width:0 !important; max-width:100%; box-sizing:border-box; }
.ytm-ui .ytm-reader { scrollbar-width:auto; scrollbar-color:#ff0000 #273446; }
.ytm-ui .ytm-reader::-webkit-scrollbar { width:10px; }
.ytm-ui .ytm-reader::-webkit-scrollbar-track { background:#273446; border-radius:8px; }
.ytm-ui .ytm-reader::-webkit-scrollbar-thumb { background:#ff0000; border:2px solid #273446; border-radius:8px; }
.ytm-ui .ytm-compact-slider input[type="range"] { accent-color:var(--ytm-accent); }
.ytm-ui .ytm-hint { font-size:12px; color:#b2becd; line-height:1.5; }
.ytm-ui .ytm-key { padding:2px 6px; border:1px solid #536177; border-radius:5px; color:#f4f6fa; font-size:11px; }
.ytm-lyrics-layout { display:flex; flex-direction:row; gap:10px; flex:1; min-width:0; min-height:0; overflow:hidden; }
.ytm-player-view,.ytm-lyrics-view { position:relative; isolation:isolate; --ytm-cover-accent:180,202,220; }
.ytm-player-view { overflow:hidden; border-radius:12px; background:#171b20; }
.ytm-ui.ytm-player-view .ytm-button { background:#30363e; background-image:none; border-color:#414952; box-shadow:none; backdrop-filter:none; }
.ytm-ui.ytm-player-view .ytm-button.gpfocus,.ytm-ui.ytm-player-view .ytm-button:focus { background:#46515e; }
.ytm-ui.ytm-player-view .ytm-selected { color:rgb(var(--ytm-cover-accent)); border-color:rgba(var(--ytm-cover-accent),.55); }
.ytm-ui.ytm-player-view .ytm-rating-button,.ytm-ui.ytm-player-view .ytm-rating-button.ytm-selected { border-color:#414952; color:#fff; }
.ytm-ui.ytm-player-view .ytm-rating-button:focus,.ytm-ui.ytm-player-view .ytm-rating-button.gpfocus { outline:none; border-color:#596572; box-shadow:none; }
.ytm-atmosphere { position:absolute; inset:0; overflow:hidden; z-index:0; pointer-events:none; background:#080b11; }
.ytm-player-view > :not(.ytm-atmosphere) { position:relative; z-index:1; }
.ytm-atmosphere-art { position:absolute; inset:-60px; background-position:center; background-size:cover; filter:blur(48px) saturate(1.25); opacity:.65; transform:scale(1.08); }
.ytm-atmosphere-shade { position:absolute; inset:0; background:linear-gradient(120deg,rgba(5,8,14,.45),rgba(5,8,14,.72)),radial-gradient(ellipse at 22% 48%,rgba(var(--ytm-cover-accent),.12),transparent 70%); }
.ytm-cover-logo { color:rgb(var(--ytm-cover-accent)); flex-shrink:0; transition:color 800ms ease; }
.ytm-ui.ytm-player-view > .ytm-card { background:#252b32; border:1px solid #343c45; box-shadow:none; backdrop-filter:none; }
.ytm-ui .ytm-lyrics-source { margin-top:14px; font-size:10px; line-height:1.5; color:rgba(255,255,255,.42); overflow-wrap:anywhere; }
.ytm-ui .ytm-lyric-line { min-height:1em; transition:none; }
.ytm-ui .ytm-lyric-active { color:#fff; text-shadow:0 2px 24px rgba(var(--ytm-cover-accent),.3); }
.ytm-ui.ytm-immersive .ytm-reader { background:transparent; border:0; border-radius:0; outline:none; box-shadow:none; scrollbar-width:none; mask-image:linear-gradient(transparent,#000 12%,#000 86%,transparent); -webkit-mask-image:linear-gradient(transparent,#000 12%,#000 86%,transparent); }
.ytm-ui.ytm-immersive .ytm-reader::-webkit-scrollbar { display:none; }
.ytm-ui.ytm-immersive .ytm-button:focus,.ytm-ui.ytm-immersive .ytm-button.gpfocus { outline:1px solid rgba(var(--ytm-cover-accent),.45); background:rgba(255,255,255,.06); }
.ytm-ui.ytm-lyrics-view .ytm-reader { scrollbar-color:rgba(var(--ytm-cover-accent),.55) transparent; }
.ytm-ui.ytm-lyrics-view .ytm-reader::-webkit-scrollbar-thumb { background:rgba(var(--ytm-cover-accent),.55); border-color:transparent; }
@media (prefers-reduced-motion:reduce) { .ytm-ui .ytm-lyric-line { transition:none; } }
/* The Quick Access panel becomes narrower on some external display layouts. */
@media (max-width:360px) {
  .ytm-player-view { padding-left:0 !important; padding-right:0 !important; }
  .ytm-player-view .ytm-card { padding-left:7px !important; padding-right:7px !important; }
  .ytm-player-view .ytm-button { padding-left:4px !important; padding-right:4px !important; }
  .ytm-lyrics-layout { gap:7px; }
}
`;

