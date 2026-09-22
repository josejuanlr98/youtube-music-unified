const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const effects = [];
let resolveLock, released = 0, unblocked = 0, requests = 0, backs = 0, reopened = 0, returned = 0;
const document = {visibilityState:'visible', addEventListener(){}, removeEventListener(){}};
const modules = {
 'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
 'react':{useState:v=>[typeof v==='function'?v():v,()=>{}],useRef:()=>({current:null}),useEffect:fn=>effects.push(fn)},
 '@decky/ui':{Focusable:'div',DialogButton:'button',Navigation:{NavigateBack(){backs++},OpenQuickAccessMenu(){reopened++}},GamepadButton:{},QuickAccessTab:{Decky:1}},
 'react-icons/fa':{}, 'react-icons/md':{}, 'react-icons/si':{}, '../services/lyricsScroll':{}, '../services/syncedLyrics':{}, '../services/notifications':{},
 '../services/audioManager':{getIsCastConnected:()=>false, getCastSenderName:()=>null, addCastConnectionListener:()=>()=>{}, getCurrentTrack:()=>null,getProgress:()=>({position:45}),addProgressListener(){},addTrackChangeListener(){}},
 '../services/lyrics':{},'../services/focus':{}
};
const result = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/LyricsPage.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports:result,require:n=>modules[n],document,navigator:{wakeLock:{request:()=>{requests++;return new Promise(resolve=>resolveLock=resolve)}}},
 Event:class {constructor(type){this.type=type}}, window:{dispatchEvent(event){assert.equal(event.type,'ytm-return-player'); returned++},SuspendResumeStore:{BlockSuspendAction:()=>()=>unblocked++}},setTimeout
});
(async()=>{
 const root = result.LyricsPanel({fullScreen:true});
 const cleanup=effects[3]();
 assert.equal(requests,1);
 cleanup(); assert.equal(unblocked,1);
 resolveLock({release:async()=>{released++}});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(released,1,'wake lock resolving after exit must be released');
 root.props.onCancelButton({preventDefault(){},stopPropagation(){}});
 root.props.onCancelButton({preventDefault(){},stopPropagation(){}});
 assert.equal(backs,1); assert.equal(returned,1);
 await new Promise(resolve=>setTimeout(resolve,230));
 assert.equal(reopened,1);
 console.log('PASS fullscreen releases wake locks and B returns to Decky exactly once');
})().catch(e=>{console.error(e);process.exitCode=1});
