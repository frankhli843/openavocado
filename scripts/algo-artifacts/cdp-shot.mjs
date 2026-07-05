// Minimal CDP screenshot driver — no external deps (Node 22 global WebSocket).
// Usage: node cdp-shot.mjs <url> <width> <height> <outPath> [waitMs] [fullPage]
const [url, width, height, outPath, waitMs = "2200", fullPage = "0"] = process.argv.slice(2);
const CDP = process.env.CDP || "http://127.0.0.1:9222";

async function http(p) {
  const r = await fetch(`${CDP}${p}`, { method: "PUT" }).catch(() => fetch(`${CDP}${p}`));
  return r.json();
}

function conn(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    } else if (m.method) events.push(m);
  });
  const ready = new Promise((res) => ws.addEventListener("open", res));
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  return { send, ready, close: () => ws.close() };
}

const w = Number(width), h = Number(height);
const targets = await http("/json/new?about:blank").catch(() => null);
const target = targets && targets.webSocketDebuggerUrl ? targets : (await http("/json/new"));
const c = conn(target.webSocketDebuggerUrl);
await c.ready;
await c.send("Page.enable");
await c.send("Emulation.setDeviceMetricsOverride", {
  width: w, height: h, deviceScaleFactor: 1, mobile: w <= 500,
});
await c.send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, Number(waitMs)));
const shot = await c.send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: fullPage === "1",
  ...(fullPage === "1" ? { clip: undefined } : {}),
});
const fs = await import("fs");
fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
console.log(`wrote ${outPath} (${w}x${h})`);
// Close the tab we opened
await http(`/json/close/${target.id}`).catch(() => {});
c.close();
process.exit(0);
