"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CharacterRepository {
    constructor(db) {
        this.db = db;
    }
    parseCharacter(data) {
        try {
            return JSON.parse(data);
        }
        catch (_a) {
            return null;
        }
    }
    // ---------------- GET ALL ----------------
    getByUserId(userId) {
        const rows = this.db
            .prepare('SELECT * FROM characters WHERE user_id = ?')
            .all(userId);
        return rows
            .map(r => this.parseCharacter(r.data))
            .filter((character) => character !== null);
    }
    // ---------------- GET ONE ----------------
    getById(id, userId) {
        const row = this.db
            .prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?')
            .get(id, userId);
        if (!row)
            return null;
        return this.parseCharacter(row.data);
    }
    // ---------------- CREATE ----------------
    create(character, userId) {
        const createdAt = Date.now();
        const stored = Object.assign(Object.assign({}, character), { id: character.id, createdAt });
        this.db.prepare(`
            INSERT INTO characters (id, user_id, data, created_at)
            VALUES (?, ?, ?, ?)
        `).run(character.id, userId, JSON.stringify(stored), createdAt);
        return stored;
    }
    // ---------------- UPDATE (PATCH MERGE) ----------------
    update(id, userId, patch) {
        const current = this.getById(id, userId);
        if (!current)
            return null;
        const updated = Object.assign(Object.assign(Object.assign({}, current), patch), { id: current.id, createdAt: current.createdAt });
        this.db.prepare(`
            UPDATE characters
            SET data = ?
            WHERE id = ? AND user_id = ?
        `).run(JSON.stringify(updated), id, userId);
        return updated;
    }
    // ---------------- DELETE ----------------
    delete(id, userId) {
        const result = this.db.prepare(`
            DELETE FROM characters
            WHERE id = ? AND user_id = ?
        `).run(id, userId);
        return result.changes > 0;
    }
}
exports.default = CharacterRepository;
