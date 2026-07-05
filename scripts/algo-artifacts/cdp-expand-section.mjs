// Expand CollapsibleLessonSection accordions by clicking button[aria-expanded]
// whose text matches each needle, then full-page screenshot.
// Usage: node cdp-expand-section.mjs <url> <w> <h> <out> <needle...>
const [url, width, height, out, ...needles] = process.argv.slice(2);
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
for (const needle of needles) {
  const expr = `(() => {
    const btns=[...document.querySelectorAll('button[aria-expanded]')];
    const el=btns.find(b=>b.textContent&&b.textContent.includes(${JSON.stringify(needle)}));
    if(!el) return 'not found: '+${JSON.stringify(needle)};
    if(el.getAttribute('aria-expanded')==='true') return 'already open: '+${JSON.stringify(needle)};
    el.scrollIntoView({block:'center'}); el.click(); return 'clicked: '+${JSON.stringify(needle)};
  })()`;
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  console.log(r.result?.value);
  await new Promise((r) => setTimeout(r, 2600));
}
await new Promise((r) => setTimeout(r, 1800));
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
const fs = await import("fs");
fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`wrote ${out}`);
await http(`/json/close/${t.id}`).catch(() => {});
process.exit(0);
