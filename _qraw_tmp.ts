import Database from "better-sqlite3";
import fs from "node:fs";
const db = new Database("data/avocadocore.db", { readonly: true });
const outdir = process.argv[2];
fs.mkdirSync(outdir, { recursive: true });
const lesson = db.prepare("SELECT * FROM lessons WHERE id=28").get() as any;
fs.writeFileSync(`${outdir}/lesson28-fields.json`, JSON.stringify({
  title: lesson.title, description: lesson.description, goals: lesson.goals,
  tags: lesson.tags, next_lesson_diagnostics: lesson.next_lesson_diagnostics,
  knowledge_graph_data: lesson.knowledge_graph_data, source_context: lesson.source_context,
  planning_rationale: lesson.planning_rationale, generated_by: lesson.generated_by,
  generator_version: lesson.generator_version
}, null, 2));
const acts = db.prepare("SELECT * FROM lesson_activities WHERE lesson_id=28 ORDER BY sequence_order,id").all() as any[];
for (const a of acts) {
  fs.writeFileSync(`${outdir}/l28-act-${a.id}-${a.activity_type}.json`, a.content ?? "");
}
console.log("wrote", acts.length, "activities +fields to", outdir);
