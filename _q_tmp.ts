import Database from "better-sqlite3";
const db = new Database("data/avocadocore.db", { readonly: true });
const sql = process.argv[2];
console.log(JSON.stringify(db.prepare(sql).all(), null, 2));
