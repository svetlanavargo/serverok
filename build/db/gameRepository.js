"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GameRepository {
    constructor(db) {
        this.db = db;
    }
    parseGame(data) {
        try {
            const parsed = JSON.parse(data);
            if (typeof parsed.id !== 'string' ||
                typeof parsed.name !== 'string' ||
                !Array.isArray(parsed.cards) ||
                (parsed.turnTimeMode !== 'round' && parsed.turnTimeMode !== 'time')) {
                return null;
            }
            return parsed;
        }
        catch (_a) {
            return null;
        }
    }
    // ---------------- GET ----------------
    getByUserId(userId) {
        const rows = this.db
            .prepare('SELECT * FROM games WHERE user_id = ?')
            .all(userId);
        return rows
            .map(row => this.toDomain(row))
            .filter((game) => game !== null);
    }
    getById(id, userId) {
        const row = this.db
            .prepare('SELECT * FROM games WHERE id = ? AND user_id = ?')
            .get(id, userId);
        return row ? this.toDomain(row) : null;
    }
    // ---------------- CREATE ----------------
    create(userId, game) {
        const createdAt = Date.now();
        this.db.prepare(`
            INSERT INTO games (id, user_id, name, created_at, data)
            VALUES (?, ?, ?, ?, ?)
        `).run(game.id, userId, game.name, createdAt, JSON.stringify(game));
        return game;
    }
    // ---------------- UPDATE ----------------
    update(patch, userId) {
        const current = this.getById(patch.id, userId);
        if (!current) {
            return null;
        }
        const updated = Object.assign(Object.assign({}, current), patch);
        this.db.prepare(`
            UPDATE games
            SET
                name = ?,
                data = ?
            WHERE id = ? AND user_id = ?
        `).run(updated.name, JSON.stringify(updated), patch.id, userId);
        return updated;
    }
    // ---------------- DELETE ----------------
    delete(id, userId) {
        const result = this.db.prepare(`
            DELETE FROM games
            WHERE id = ? AND user_id = ?
        `).run(id, userId);
        return result.changes > 0;
    }
    // ---------------- MAPPER ----------------
    toDomain(row) {
        const parsed = this.parseGame(row.data);
        if (parsed) {
            return parsed;
        }
        return {
            id: row.id,
            name: row.name,
            cards: [],
            turnTimeMode: 'round'
        };
    }
}
exports.default = GameRepository;
