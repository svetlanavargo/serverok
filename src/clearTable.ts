import DatabaseConstructor from 'better-sqlite3';
import database from './index';

const db: ReturnType<typeof DatabaseConstructor> = database;

interface TableRow {
    name: string;
}

const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name != 'migrations'
`).all() as TableRow[];

const hasSequence = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name = 'sqlite_sequence'
`).get();

const transaction = db.transaction(() => {
    for (const { name } of tables) {
        db.prepare(`DELETE FROM ${name}`).run();

        if (hasSequence) {
            db.prepare(`
                DELETE FROM sqlite_sequence
                WHERE name = ?
            `).run(name);
        }

        console.log(`Очищена таблица: ${name}`);
    }
});

transaction();

console.log('База очищена');