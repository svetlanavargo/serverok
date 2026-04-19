"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const index_1 = __importDefault(require("./index"));
const db = index_1.default;
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
        db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file);
    });
    transaction();
}
