const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const api={}, timers=new Map(), records=[];
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ArtworkBackdrop.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports:api,require:n=>n.endsWith('visualDiagnostics')?{recordVisualDiagnostic:(...v)=>records.push(v)}:{},
 setTimeout:fn=>{const id=timers.size+1;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)
});
let preference,removed=0,rule='',transform='matrix(1.14)',time=0;
const reduced={matches:false,addEventListener:(_,fn)=>preference=fn,removeEventListener:()=>preference=null};
const declarations={};
const doc={visibilityState:'hidden',head:{appendChild(s){rule=s.textContent}},createElement:()=>({textContent:'',remove(){removed++}}),defaultView:{matchMedia:()=>reduced,getComputedStyle:()=>({transform})}};
const element={ownerDocument:doc,style:{setProperty:(k,v,priority)=>{assert.equal(priority,'important');declarations[k]=v},removeProperty:k=>delete declarations[k]},getAnimations:()=>[{currentTime:time,playState:'running'}]};
const cleanup=api.startArtworkMotion(element);
assert(rule.includes('@keyframes ytm-artwork-drift'));
assert(declarations.animation.includes('18s'),'full screen CSS motion does not depend on hidden document flags');
timers.get(1)(); transform='matrix(1.16)';time=2000;timers.get(2)();
assert(records.at(-1)[1].includes('changed=true; clock=true'));
reduced.matches=true;preference();assert.equal(declarations.animation,'none');
reduced.matches=false;preference();assert(declarations.animation.includes('18s'));
cleanup();assert.equal(timers.size,0);assert.equal(removed,1);assert.equal(preference,null);assert.equal(declarations.animation,undefined);
console.log('PASS CSS motion owns mounted document, observes elapsed motion, honors reduced motion and cleans up');
