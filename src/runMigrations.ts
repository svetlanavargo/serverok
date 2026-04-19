import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

const db = new Database(
    path.join(process.cwd(), 'data', 'database.sqlite')
);

// создаём таблицу migrations
db.exec(`
CREATE TABLE IF NOT EXISTS migrations (
  filename TEXT PRIMARY KEY,
  applied_at INTEGER
);
`);

const migrationsDir = path.join(process.cwd(), 'migrations');

const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

const applied = db.prepare(
    'SELECT filename FROM migrations'
).all() as { filename: string }[];

const appliedSet = new Set(applied.map(m => m.filename));

for (const file of files) {
    if (appliedSet.has(file)) continue;

    console.log('Applying:', file);

    const sql = fs.readFileSync(
        path.join(migrationsDir, file),
        'utf-8'
    );

    db.transaction(() => {
        db.exec(sql);
        db.prepare(
            'INSERT INTO migrations (filename, applied_at) VALUES (?, ?)'
        ).run(file, Date.now());
    })();
}

console.log('MIGRATIONS DONE ✔');
db.close();