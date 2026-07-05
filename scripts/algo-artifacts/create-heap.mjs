import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const BASE = process.env.AVO_BASE || "http://127.0.0.1:3742";
const here = path.dirname(fileURLToPath(import.meta.url));
const A = [
  { slug: "algo-heap-overview-map", title: "Heap — Pattern Orientation Map", file: "algo-heap-overview-map.tsx" },
  { slug: "algo-heap-tree", title: "Heap — Binary Heap Sift Up/Down", file: "algo-heap-tree.tsx" },
  { slug: "algo-heap-topk", title: "Heap — Size-k Min-Heap Top-K", file: "algo-heap-topk.tsx" },
];
async function j(u,o){const r=await fetch(u,o);const t=await r.text();let b;try{b=JSON.parse(t)}catch{b=t}return{status:r.status,body:b}}
for (const a of A) {
  const source = fs.readFileSync(path.join(here, a.file), "utf8");
  const c = await j(`${BASE}/api/visual-artifacts`, { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({slug:a.slug,title:a.title,source_react:source})});
  if (c.status===409){ const p=await j(`${BASE}/api/visual-artifacts/${a.slug}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({source_react:source})}); console.log(`[${a.slug}] PATCH ${p.status}`);}
  else console.log(`[${a.slug}] POST ${c.status}${c.status>=400?" "+JSON.stringify(c.body):""}`);
}
