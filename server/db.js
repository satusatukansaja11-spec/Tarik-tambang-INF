import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedQuestions } from './questions.js';
export function openDB(dir) {
 mkdirSync(dir,{recursive:true});
 const db=new DatabaseSync(resolve(dir,'game.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY,finished_at TEXT NOT NULL,payload TEXT NOT NULL);`);
 if(!db.prepare("SELECT value FROM settings WHERE key='seeded'").get()) {
  for(const q of seedQuestions) db.prepare('INSERT OR IGNORE INTO questions VALUES(?,?)').run(q.id,JSON.stringify(q));
  db.prepare("INSERT INTO settings VALUES('seeded','true')").run();
 }
 return {
  raw:db,
  getSetting:k=>db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value,
  setSetting:(k,v)=>db.prepare('INSERT OR REPLACE INTO settings VALUES(?,?)').run(k,v),
  questions:()=>db.prepare('SELECT payload FROM questions').all().map(r=>JSON.parse(r.payload)),
  putQuestion:q=>db.prepare('INSERT OR REPLACE INTO questions VALUES(?,?)').run(q.id,JSON.stringify(q)),
  deleteQuestion:id=>db.prepare('DELETE FROM questions WHERE id=?').run(id),
  saveRoom:r=>db.prepare('INSERT OR REPLACE INTO rooms VALUES(?,?)').run(r.code,JSON.stringify(r)),
  rooms:()=>db.prepare('SELECT payload FROM rooms').all().map(r=>JSON.parse(r.payload)),
  saveHistory:r=>db.prepare('INSERT OR REPLACE INTO history VALUES(?,?,?)').run(r.id,r.finishedAt,JSON.stringify(r)),
  history:()=>db.prepare('SELECT payload FROM history ORDER BY finished_at DESC LIMIT 200').all().map(r=>JSON.parse(r.payload)),
  close:()=>db.close()
 };
}
