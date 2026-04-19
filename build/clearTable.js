"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
const db = index_1.default;
const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name != 'migrations'
`).all();
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
