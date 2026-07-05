const [url,w]=process.argv.slice(2); const CDP="http://127.0.0.1:9222";
async function http(p){const r=await fetch(`${CDP}${p}`,{method:"PUT"}).catch(()=>fetch(`${CDP}${p}`));return r.json();}
const t=await http("/json/new?about:blank");const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const pend=new Map();
ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}});
await new Promise(r=>ws.addEventListener("open",r));
const send=(m,p={})=>new Promise(res=>{const mid=++id;pend.set(mid,res);ws.send(JSON.stringify({id:mid,method:m,params:p}));});
await send("Page.enable");await send("Emulation.setDeviceMetricsOverride",{width:Number(w),height:2000,deviceScaleFactor:1,mobile:true});
await send("Page.navigate",{url});await new Promise(r=>setTimeout(r,4500));
const r=await send("Runtime.evaluate",{expression:"JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})",returnByValue:true});
console.log("overflow:",r.result.value);await http(`/json/close/${t.id}`);process.exit(0);
