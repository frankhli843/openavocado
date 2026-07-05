// Expand a code_drill section, start the drill, verify timer + hints, screenshot.
// Usage: node cdp-drill-qa.mjs <url> <w> <h> <out> <titleRe> <promptRe>
const [url, width, height, out, titleRe, promptRe] = process.argv.slice(2);
const TITLE = titleRe || "Drill: fixed-window max sum";
const PROMPT = promptRe || "maximum sum of any contiguous";
const CDP = process.env.CDP || "http://127.0.0.1:9222";
async function http(p){ const r=await fetch(`${CDP}${p}`,{method:"PUT"}).catch(()=>fetch(`${CDP}${p}`)); return r.json(); }
const t = await http("/json/new?about:blank");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pend=new Map();
ws.addEventListener("message",(e)=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}});
await new Promise(r=>ws.addEventListener("open",r));
const send=(method,params={})=>new Promise(res=>{const mid=++id;pend.set(mid,res);ws.send(JSON.stringify({id:mid,method,params}));});
const J=JSON.stringify;
const evalJs=async(expr)=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true}); if(r.exceptionDetails) return "EXC:"+(r.exceptionDetails.exception?.description||r.exceptionDetails.text); return r.result?.value;};
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:Number(width),height:Number(height),deviceScaleFactor:1,mobile:Number(width)<=500});
await send("Page.navigate",{url});
await new Promise(r=>setTimeout(r,4500));

const expand = await evalJs(`(() => {
  const re = new RegExp(${J(TITLE)});
  const header = [...document.querySelectorAll('button[aria-expanded]')].find(b => re.test(b.textContent||''));
  if(header){ header.click(); return 'expanded'; } return 'header not found';
})()`);
console.log('expand:', expand);
await new Promise(r=>setTimeout(r,1800));

const preStart = await evalJs(`(() => {
  const txt = document.body.innerText;
  return JSON.stringify({ hasStartDrill: /Start drill/i.test(txt), hasPrompt: new RegExp(${J(PROMPT)},'i').test(txt) });
})()`);
console.log('pre-start:', preStart);

const started = await evalJs(`(() => {
  const b=[...document.querySelectorAll('button')].find(e=>/Start drill/i.test(e.textContent||''));
  if(b){ b.click(); return 'clicked Start drill'; } return 'no start button';
})()`);
console.log('start:', started);
await new Promise(r=>setTimeout(r,2500));

const post = await evalJs(`(() => {
  const timer = document.querySelector('[aria-label="drill timer"]');
  const txt = document.body.innerText;
  return JSON.stringify({
    drillTimerEl: !!timer,
    timerText: timer ? timer.textContent.trim().slice(0,24) : null,
    hasHintsPanel: /Hints \\(\\d+\\/\\d+ unlocked\\)/.test(txt),
    hintLockedMsg: /first hint unlocks at 33%/.test(txt),
    hasRun: /Run tests|\\bRun\\b/.test(txt), hasSubmit: /Submit/.test(txt),
  });
})()`);
console.log('post-start:', post);
await new Promise(r=>setTimeout(r,600));
const shot = await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});
const fs = await import("fs");
fs.writeFileSync(out, Buffer.from(shot.data,"base64"));
console.log('wrote', out);
await http(`/json/close/${t.id}`).catch(()=>{});
process.exit(0);
