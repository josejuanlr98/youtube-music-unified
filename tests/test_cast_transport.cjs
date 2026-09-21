const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
const defer = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };

function setup() {
  const sockets = [], calls = [], requests = [], timers = [], intervals = new Map(), events = {};
  let play = async () => {}, response = async () => null;
  const audio = { style:{}, src:'', ended:false, paused:true, duration:180, currentTime:0,
    play:() => { audio.paused=false; return play(); }, pause:() => { audio.paused=true; },
    removeAttribute:() => { audio.src=''; }, load() {}, remove() {},
    addEventListener:(name,fn) => { events[name]=fn; }, removeEventListener:(name) => { delete events[name]; } };
  class Socket {
    static OPEN=1; readyState=1; sent=[];
    constructor() { sockets.push(this); }
    send(msg) { this.sent.push(JSON.parse(msg)); }
    close() {}
  }
  const api = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/services/audioManager.ts'),'utf8'), {
    compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 }
  }).outputText, {
    exports:api, require:() => ({ call:async name => { calls.push(name); return { success:true }; } }), console,
    document:{ getElementById:() => audio }, WebSocket:Socket,
    fetch:async url => { requests.push(url); return { json:() => response(url) }; },
    setTimeout:fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    setInterval:fn => { const id=intervals.size+1; intervals.set(id,fn); return id; }, clearInterval:id => intervals.delete(id),
  });
  api.initAudio();
  return { api, audio, sockets, calls, requests, events, timers, intervals,
    play:fn => { play=fn; }, response:fn => { response=fn; },
    message:(event,data) => sockets.at(-1).onmessage({ data:JSON.stringify({ event,data }) }) };
}
const track = (id) => ({ videoId:id, playbackId:`play-${id}`, title:id, url:`https://audio.test/${id}`, duration:180 });

(async () => {
  const s=setup();
  s.message('connection',{ phoneConnected:true, senderName:'Phone' });
  s.message('track',track('one')); await tick();
  assert(s.sockets[0].sent.some(m => m.event==='playing' && m.data.playbackId==='play-one'));
  s.sockets[0].readyState=3; s.sockets[0].onclose();
  assert.equal(s.api.getIsCastConnected(),true,'local transport loss must not switch Queue to local mode');
  await s.api.playNext();
  assert(s.requests.some(url => url.endsWith('/api/next')));
  assert(!s.calls.includes('next_track'),'transport outage must never switch to the local queue');
  s.audio.ended=true; s.events.ended();
  assert(!s.calls.includes('track_ended'));
  s.timers.shift()();
  s.response(async url => url.endsWith('/api/state') ? { connected:true, track:track('one'), isPlaying:true } : null);
  s.sockets[1].onopen(); await tick();
  assert(s.sockets[1].sent.some(m => m.event==='ended' && m.data.playbackId==='play-one'),'reconnect replays pending end for the same playback only');
  s.audio.ended=false;
  s.message('track',track('two')); await tick();
  for (const fn of s.intervals.values()) fn();
  assert.equal(s.sockets[1].sent.at(-1).data.playbackId,'play-two');
  s.api.destroyAudio();

  const race=setup(), old=defer();
  race.play(() => old.promise);
  race.message('track',track('old'));
  race.play(async () => {});
  race.message('track',track('new')); await tick();
  old.reject(Error('interrupted by next song')); await tick();
  assert.equal(race.api.getCurrentTrack().videoId,'new');
  assert.equal(race.api.getIsPlaying(),true);
  assert(!race.sockets[0].sent.some(m => m.event==='playbackError'),'rejected old play must not retry the new song');
  const late=defer(); race.play(() => late.promise);
  race.message('track',track('paused'));
  race.message('state',{ isPlaying:false }); late.resolve(); await tick();
  assert.equal(race.api.getIsPlaying(),false,'pause while loading must win over late play resolution');
  race.api.destroyAudio();

  const stale=setup(), snapshot=defer();
  stale.response(url => url.endsWith('/api/state') ? snapshot.promise : Promise.resolve(null));
  stale.sockets[0].onopen();
  stale.message('track',track('latest')); await tick();
  snapshot.resolve({ connected:true, track:track('outdated'), isPlaying:true }); await tick();
  assert.equal(stale.api.getCurrentTrack().videoId,'latest');
  stale.api.destroyAudio();
  console.log('PASS Cast transport: ownership during outage, replay after reconnect, playback IDs, stale responses and pause races');
})().catch(error => { console.error(error); process.exitCode=1; });
