import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DATABASE_PATH } from './config';

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

const db = new Database(DATABASE_PATH);

type TableInfoRow = {
    name: string;
};

function hasTable(tableName: string): boolean {
    const row = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
    `).get(tableName) as TableInfoRow | undefined;

    return Boolean(row);
}

function hasColumn(tableName: string, columnName: string): boolean {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;

    return rows.some(row => row.name === columnName);
}

function repairLegacySchema() {
    if (hasTable('users') && !hasColumn('users', 'data')) {
        db.exec(`ALTER TABLE users ADD COLUMN data TEXT DEFAULT '{}'`);
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS characters (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            data TEXT NOT NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            data TEXT NOT NULL
        )
    `);
}

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
        db.prepare(
            'INSERT INTO migrations (filename, applied_at) VALUES (?, ?)'
        ).run(file, Date.now());
    });

    transaction();
}

repairLegacySchema();

db.close();
