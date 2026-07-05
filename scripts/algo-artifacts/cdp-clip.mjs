// Expand a section, scroll to an anchor element (by text), and screenshot the
// viewport around it at readable scale.
// Usage: node cdp-clip.mjs <url> <w> <h> <out> <expandNeedle> <scrollNeedle>
const [url, width, height, out, expandNeedle, scrollNeedle] = process.argv.slice(2);
const CDP = process.env.CDP || "http://127.0.0.1:9222";
async function http(p) { const r = await fetch(`${CDP}${p}`, { method: "PUT" }).catch(() => fetch(`${CDP}${p}`)); return r.json(); }
const t = await http("/json/new?about:blank");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pend.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: Number(width) <= 500 });
await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, 4000));
if (expandNeedle) {
  const expr = `(() => { const b=[...document.querySelectorAll('button[aria-expanded]')].find(x=>x.textContent&&x.textContent.includes(${JSON.stringify(expandNeedle)})); if(b&&b.getAttribute('aria-expanded')!=='true'){b.click();return 'clicked';} return 'noop'; })()`;
  console.log((await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.value);
  await new Promise((r) => setTimeout(r, 2800));
}
const scrollExpr = `(() => { const els=[...document.querySelectorAll('h1,h2,h3,h4,label,button,div,span')]; const el=els.find(e=>e.textContent&&e.textContent.trim().startsWith(${JSON.stringify(scrollNeedle)})&&e.offsetHeight>0&&e.offsetHeight<400); if(el){el.scrollIntoView({block:'start'}); window.scrollBy(0,-40); return 'scrolled to: '+${JSON.stringify(scrollNeedle)};} return 'anchor not found'; })()`;
console.log((await send("Runtime.evaluate", { expression: scrollExpr, returnByValue: true })).result?.value);
await new Promise((r) => setTimeout(r, 1500));
const shot = await send("Page.captureScreenshot", { format: "png" });
const fs = await import("fs");
fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`wrote ${out}`);
await http(`/json/close/${t.id}`).catch(() => {});
process.exit(0);
