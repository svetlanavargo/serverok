import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import database from './database.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, '../migrations');
const migrationFiles = fs.readdirSync(migrationsDir).sort();

database.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    filename TEXT PRIMARY KEY,
    applied_at INTEGER
  )
`);

const applied = database.prepare("SELECT filename FROM migrations").all();

for (const file of migrationFiles) {
    if (applied.find(a => a.filename === file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    database.exec(sql);

    const stmt = database.prepare("INSERT INTO migrations(filename, applied_at) VALUES(?, ?)");
    stmt.run(file, Date.now());
}