import fs from 'node:fs';
import path from 'node:path';
import DatabaseConstructor from 'better-sqlite3';
import database from './src/index';

const db: ReturnType<typeof DatabaseConstructor> = database;

const projectRoot = process.cwd();
const migrationsDir: string = path.join(projectRoot, 'migrations');
const migrationFiles: string[] = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      filename TEXT PRIMARY KEY,
      applied_at INTEGER
    )
`);

interface MigrationRow {
    filename: string;
    applied_at?: number;
}

const applied = db.prepare("SELECT filename FROM migrations").all() as MigrationRow[];

for (const file of migrationFiles) {
    if (applied.find(a => a.filename === file)) continue;

    const sql: string = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    const transaction = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file);
    });

    transaction();
}