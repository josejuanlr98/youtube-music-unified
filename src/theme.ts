// Static, scoped styles: no animation loop, backdrop blur or image processing.
export const themeCss = `
.ytm-ui { --ytm-accent:#ff0000; --ytm-focus:#66c0f4; --ytm-muted:#b2becd; color:#f4f6fa; width:100%; max-width:100%; min-width:0; box-sizing:border-box; }
.ytm-ui .ytm-card,.ytm-ui.ytm-card { background:linear-gradient(135deg,#202c3c,#18212e); border:1px solid #354052; border-radius:12px; }
.ytm-ui .ytm-eyebrow { color:var(--ytm-muted); font-size:10px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; }
.ytm-ui .ytm-muted { color:var(--ytm-muted); }
.ytm-ui .ytm-button { border:1px solid #3b485b; border-radius:8px; background:#273446; color:#f4f6fa; min-width:0 !important; max-width:100%; box-sizing:border-box; }
.ytm-ui .ytm-button:hover { background:#36465b; }
.ytm-ui .ytm-compact-slider.gpfocus,.ytm-ui .ytm-compact-slider:focus,.ytm-ui .ytm-button:focus,.ytm-ui .ytm-button.gpfocus,.ytm-ui .ytm-reader:focus,.ytm-ui .ytm-reader.gpfocus { outline:2px solid var(--ytm-focus); outline-offset:2px; background-color:#35445a; color:#fff; }
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
/* The Quick Access panel becomes narrower on some external display layouts. */
@media (max-width:360px) {
  .ytm-player-view { padding-left:0 !important; padding-right:0 !important; }
  .ytm-player-view .ytm-card { padding-left:7px !important; padding-right:7px !important; }
  .ytm-player-view .ytm-button { padding-left:4px !important; padding-right:4px !important; }
  .ytm-lyrics-layout { gap:7px; }
}
`;

