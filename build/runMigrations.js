"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const db = new better_sqlite3_1.default(node_path_1.default.join(process.cwd(), 'data', 'database.sqlite'));
// создаём таблицу migrations
db.exec(`
CREATE TABLE IF NOT EXISTS migrations (
  filename TEXT PRIMARY KEY,
  applied_at INTEGER
);
`);
const migrationsDir = node_path_1.default.join(process.cwd(), 'migrations');
const files = node_fs_1.default.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
const applied = db.prepare('SELECT filename FROM migrations').all();
const appliedSet = new Set(applied.map(m => m.filename));
for (const file of files) {
    if (appliedSet.has(file))
        continue;
    console.log('Applying:', file);
    const sql = node_fs_1.default.readFileSync(node_path_1.default.join(migrationsDir, file), 'utf-8');
    db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO migrations (filename, applied_at) VALUES (?, ?)').run(file, Date.now());
    })();
}
console.log('MIGRATIONS DONE ✔');
db.close();
