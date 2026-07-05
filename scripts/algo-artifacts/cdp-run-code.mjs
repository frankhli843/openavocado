// Drive the Attempt-mode code editor for lesson 17 Part 1: type the reference
// solution, click Run tests, and report the visible test outcome. Verifies the
// Pyodide runner actually executes (not just that code text looks right).
const CDP = "http://127.0.0.1:9222";
async function http(p) { const r = await fetch(`${CDP}${p}`, { method: "PUT" }).catch(() => fetch(`${CDP}${p}`)); return r.json(); }
const t = await http("/json/new?about:blank");
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r));
const send = (m, p = {}) => new Promise((res) => { const mid = ++id; pend.set(mid, res); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
const ev = (expression) => send("Runtime.evaluate", { expression, returnByValue: true }).then((r) => r.result?.value);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.enable"); await send("Runtime.enable"); await send("Input.enable").catch(() => {});
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 3400, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://127.0.0.1:3742/lessons/17" });
await sleep(3800);
// Expand Part 1
await ev(`(()=>{const e=[...document.querySelectorAll('button,[role=button],div')].filter(x=>x.textContent&&x.textContent.includes('Part 1: Fixed-size window')&&x.offsetHeight>0&&x.offsetHeight<160);e[e.length-1]&&e[e.length-1].click();})()`);
await sleep(2500);

const SOL = [
  "def window_sum_first(nums, k):",
  "    total = 0",
  "    for i in range(k):",
  "        total += nums[i]",
  "    return total",
  "def slide(prev_sum, entering, leaving):",
  "    return prev_sum + entering - leaving",
  "def max_sum_size_k(nums, k):",
  "    if k <= 0 or k > len(nums):",
  "        return 0",
  "    best = current = window_sum_first(nums, k)",
  "    for right in range(k, len(nums)):",
  "        current = slide(current, nums[right], nums[right - k])",
  "        best = max(best, current)",
  "    return best",
].join("\n");

// Try CodeMirror 6 first (view on the .cm-editor element), else Monaco.
const setVia = await ev(`(()=>{
  const cm = document.querySelector('.cm-content');
  const cmRoot = document.querySelector('.cm-editor');
  if (cmRoot && cmRoot.CodeMirror) { cmRoot.CodeMirror.setValue(${JSON.stringify(SOL)}); return 'cm5'; }
  if (window.monaco && monaco.editor.getModels().length) { monaco.editor.getModels()[0].setValue(${JSON.stringify(SOL)}); return 'monaco'; }
  return cm ? 'cm6-need-type' : 'no-editor';
})()`);
console.log("editor set via:", setVia);

if (setVia === "cm6-need-type" || setVia === "no-editor") {
  // Focus editor, select all, delete, insert text via CDP input events.
  await ev(`(()=>{const e=document.querySelector('.cm-content')||document.querySelector('textarea');e&&e.focus();})()`);
  await sleep(200);
  await send("Input.dispatchKeyEvent", { type: "keyDown", modifiers: 2, key: "a", code: "KeyA", windowsVirtualKeyCode: 65 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: 2, key: "a", code: "KeyA", windowsVirtualKeyCode: 65 });
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 });
  await send("Input.insertText", { text: SOL });
  await sleep(300);
}

// Click Run tests
const clicked = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/run tests/i.test(x.textContent||''));if(b){b.click();return true;}return false;})()`);
console.log("clicked Run tests:", clicked);
// Pyodide first load can be slow.
for (let i = 0; i < 18; i++) {
  await sleep(2500);
  const status = await ev(`(()=>{const txt=document.body.innerText;const m=txt.match(/(\\d+\\s*\\/\\s*\\d+\\s*(tests?|passed|passing)[^\\n]*)/i);const passed=/all tests? passed|passed all|✓[^\\n]*pass/i.test(txt);return {snippet:(m&&m[1])||'', loading:/loading pyodide|installing|running/i.test(txt)};})()`);
  if (status.snippet && !status.loading) { console.log("RESULT:", status.snippet); break; }
  if (i === 17) console.log("timed out; last loading:", status.loading);
}
const fs = await import("fs");
const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync("state/algo-qa/lesson17-code-run.png", Buffer.from(shot.data, "base64"));
console.log("wrote run shot");
await http(`/json/close/${t.id}`).catch(() => {});
process.exit(0);
