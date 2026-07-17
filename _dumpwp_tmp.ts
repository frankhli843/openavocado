import Database from "better-sqlite3";
import fs from "node:fs";
const db = new Database("data/avocadocore.db", { readonly: true });
const wp = db.prepare("SELECT content,version,updated_at FROM subject_workpads WHERE subject_id=5").get() as any;
fs.writeFileSync("/tmp/subject5-workpad.md", wp.content);
console.log("workpad v"+wp.version+" updated "+wp.updated_at+" len="+wp.content.length);
const j = db.prepare("SELECT id,entry_type,title,created_at,length(content) as l FROM subject_journal_entries WHERE subject_id=5 ORDER BY id").all() as any[];
console.log("journal entries:", j.length);
for (const e of j) console.log(`  #${e.id} [${e.entry_type}] ${e.title} (${e.l}c) ${e.created_at}`);
