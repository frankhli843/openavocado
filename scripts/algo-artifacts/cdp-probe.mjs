const url = process.argv[2];
const CDP = process.env.CDP || "http://127.0.0.1:9222";
async function http(p){ const r = await fetch(`${CDP}${p}`,{method:"PUT"}).catch(()=>fetch(`${CDP}${p}`)); return r.json(); }
const t = await http("/json/new?about:blank");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pend=new Map();
ws.addEventListener("message",(e)=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}});
await new Promise(r=>ws.addEventListener("open",r));
const send=(method,params={})=>new Promise(res=>{const mid=++id;pend.set(mid,res);ws.send(JSON.stringify({id:mid,method,params}));});
await send("Page.enable");
await send("Page.navigate",{url});
await new Promise(r=>setTimeout(r,4000));
const expr = `(() => {
  const txt = document.body.innerText;
  return JSON.stringify({
    hasStartDrill: /Start drill/i.test(txt),
    hasDrillHeader: /code drill|Drill:/i.test(txt),
    drillTimerEl: !!document.querySelector('[aria-label="drill timer"]'),
    sectionKinds: [...document.querySelectorAll('*')].filter(e=>/^(AUDIO|LESSON PART|CODE|CODE DRILL|ASSESSMENT|PLANNING|INTERACTIVE|READING)$/.test(e.textContent?.trim()||'')).map(e=>e.textContent.trim()),
  });
})()`;
const r = await send("Runtime.evaluate",{expression:expr,returnByValue:true});
console.log(r.result?.value);
await http(`/json/close/${t.id}`).catch(()=>{});
process.exit(0);
