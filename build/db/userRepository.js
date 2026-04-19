"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function safeParse(data) {
    if (!data)
        return null;
    try {
        return JSON.parse(data);
    }
    catch (_a) {
        return null;
    }
}
class UserRepository {
    constructor(db) {
        this.db = db;
    }
    getUser(email) {
        try {
            const row = this.db
                .prepare('SELECT * FROM users WHERE email = ?')
                .get(email);
            if (!row)
                return undefined;
            return this.mapRow(row);
        }
        catch (error) {
            console.error('getUser error:', error);
            return undefined;
        }
    }
    getUserById(id) {
        try {
            const row = this.db
                .prepare('SELECT * FROM users WHERE id = ?')
                .get(id);
            if (!row)
                return undefined;
            return this.mapRow(row);
        }
        catch (error) {
            console.error('getUserById error:', error);
            return undefined;
        }
    }
    createUser(user) {
        try {
            this.db.prepare(`
                INSERT INTO users (id, email, password_hash, salt, data)
                VALUES (?, ?, ?, ?, ?)
            `).run(user.id, user.email, user.passwordHash, user.salt, null);
            return true;
        }
        catch (err) {
            console.error('createUser error:', err);
            return false;
        }
    }
    updateUserData(userId, data) {
        try {
            this.db.prepare(`
                UPDATE users
                SET data = ?
                WHERE id = ?
            `).run(JSON.stringify(data), userId);
            return true;
        }
        catch (err) {
            console.error('updateUserData error:', err);
            return false;
        }
    }
    mapRow(row) {
        return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            salt: row.salt,
            data: safeParse(row.data)
        };
    }
}
exports.default = UserRepository;
