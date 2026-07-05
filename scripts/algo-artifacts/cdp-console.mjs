const [url, waitMs = "3500"] = process.argv.slice(2);
const CDP = process.env.CDP || "http://127.0.0.1:9222";
async function http(p) { const r = await fetch(`${CDP}${p}`, { method: "PUT" }).catch(() => fetch(`${CDP}${p}`)); return r.json(); }
const t = await http("/json/new?about:blank");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const logs = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  else if (m.method === "Runtime.consoleAPICalled") logs.push(`[${m.params.type}] ` + m.params.args.map(a => a.value ?? a.description ?? JSON.stringify(a.preview ?? "")).join(" "));
  else if (m.method === "Runtime.exceptionThrown") logs.push("[EXCEPTION] " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  else if (m.method === "Log.entryAdded") logs.push(`[log:${m.params.entry.level}] ${m.params.entry.text}`);
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pend.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, Number(waitMs)));
console.log(logs.slice(0, 40).join("\n") || "(no console output)");
await http(`/json/close/${t.id}`).catch(() => {});
process.exit(0);
