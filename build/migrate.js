"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const config_1 = require("./config");
node_fs_1.default.mkdirSync(node_path_1.default.dirname(config_1.DATABASE_PATH), { recursive: true });
const db = new better_sqlite3_1.default(config_1.DATABASE_PATH);
function hasTable(tableName) {
    const row = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
    `).get(tableName);
    return Boolean(row);
}
function hasColumn(tableName, columnName) {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
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
const migrationsDir = node_path_1.default.join(projectRoot, 'migrations');
const migrationFiles = node_fs_1.default.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      filename TEXT PRIMARY KEY,
      applied_at INTEGER
    )
`);
const applied = db.prepare("SELECT filename FROM migrations").all();
for (const file of migrationFiles) {
    if (applied.find(a => a.filename === file))
        continue;
    const sql = node_fs_1.default.readFileSync(node_path_1.default.join(migrationsDir, file), 'utf-8');
    const transaction = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO migrations (filename, applied_at) VALUES (?, ?)').run(file, Date.now());
    });
    transaction();
}
repairLegacySchema();
db.close();
