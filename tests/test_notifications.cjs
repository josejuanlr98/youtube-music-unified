const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/services/notifications.tsx'), 'utf8');
const exportsObject = {};
const listeners = {};
let stored = { connections:true, tracks:true, connectionSound:false, trackSound:false };
const toasts = [];
let dismissed = 0;
const timers = new Map();
const listen = key => fn => { listeners[key] = fn; return () => { delete listeners[key]; }; };
const modules = {
  '@decky/api': { call:async (method, value) => { if (method.startsWith('set_')) stored = value; return { ...stored }; },
    toaster:{ toast:data => { toasts.push(data); return { data, dismiss:() => { dismissed++; } }; } } },
  'react/jsx-runtime':{ jsx:(type, props) => ({ type, props }) },
  'react-icons/si':{ SiYoutubemusic:'icon' },
  './audioManager':{ addPlaybackStartedListener:listen('playing'), addSenderConnectedListener:listen('sender'), addTrackChangeListener:listen('track') },
};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions:{ module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2022 } }).outputText, {
  exports:exportsObject, require:name => { assert(name in modules, name); return modules[name]; }, console,
  setTimeout:fn => { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout:id => timers.delete(id),
});
(async () => {
  const stop = exportsObject.initNotifications();
  await exportsObject.loadNotificationSettings();
  assert.equal(toasts.length, 0);
  listeners.sender('Desktop');
  assert.equal(toasts[0].body, 'Desktop has connected');
  assert.equal(toasts[0].playSound, false);
  const track = { videoId:'one', title:'Song', artist:'Artist', albumArt:'https://example.test/art.jpg' };
  listeners.playing(track);
  assert.equal(toasts[1].title, 'Song'); assert.equal(toasts[1].body, 'Artist');
  assert.equal(toasts[1].logo.props.src, track.albumArt); assert.equal(toasts[1].playSound, false);
  listeners.playing(track); listeners.playing(track);
  assert.equal(toasts.length, 2, 'resume and repeated state/stream messages must not duplicate a song');
  await exportsObject.saveNotificationSettings({ ...stored, tracks:false, connectionSound:true });
  listeners.playing({ ...track, videoId:'two' });
  assert.equal(toasts.length, 2);
  listeners.sender('Tablet'); assert.equal(toasts.at(-1).playSound, true);
  await exportsObject.saveNotificationSettings({ ...stored, tracks:true, trackSound:true, connections:false });
  listeners.sender('Muted device'); assert.equal(toasts.length, 3);
  listeners.playing({ ...track, videoId:'three' }); assert.equal(toasts.at(-1).playSound, true);
  assert(dismissed > 0, 'fast events must bound active toasts');
  stop(); assert.equal(Object.keys(listeners).length, 0); assert.equal(timers.size, 0);
  console.log('PASS notifications: silent defaults, independent toggles/sounds, metadata, deduplication, bounded toasts and cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
