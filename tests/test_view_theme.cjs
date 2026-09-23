const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,modules={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>modules[n]||{}});
 return exports;
}
const {lyricsSource}=load('src/services/lyricsSource.ts');
for(const source of ['Musixmatch','Source: Musixmatch',' Source: Source: Musixmatch ','source: Fuente: Musixmatch'])assert.equal(lyricsSource(source),'Musixmatch');
assert.equal(lyricsSource('Source: '),'');assert.equal(lyricsSource(null),'');assert.equal(lyricsSource('LRCLIB'),'LRCLIB');
const {attachViewTheme}=load('src/components/ThemeScope.tsx',{'../theme':{themeCss:'test theme'}});
const {themeCss}=load('src/theme.ts');
assert.match(themeCss,/ytm-rating-button:focus[^}]*outline:none/);
assert.match(themeCss,/ytm-compact-slider \.gpfocus[^}]*border-radius:8px/);
const makeDoc=()=>{const nodes=[];return {nodes,head:{appendChild:s=>nodes.push(s)},createElement:()=>({dataset:{},style:{setProperty(...args){assert.deepEqual(args,['display','none','important'])}},remove(){nodes.splice(nodes.indexOf(this),1)}})}};
const a=makeDoc(),b=makeDoc();const releaseA=attachViewTheme(a),releaseA2=attachViewTheme(a),releaseB=attachViewTheme(b);
assert.equal(a.nodes.length,1);assert.equal(b.nodes.length,1);assert.equal(b.nodes[0].textContent,'test theme');
releaseA();releaseA();assert.equal(a.nodes.length,1);releaseA2();assert.equal(a.nodes.length,0);assert.equal(b.nodes.length,1);releaseB();assert.equal(b.nodes.length,0);
console.log('PASS source normalization and separate-document theme ownership, sharing and cleanup');
