import database from './database.mjs';
import crypto from 'node:crypto';

export default class UserRepository {
    constructor(database) {
        this.db = database;
    }

    getUser(email) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
        const row = stmt.get(email);
        if (!row) return undefined;

        return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            salt: row.salt
        };
    }

    saveUser({ id, email, passwordHash, salt }) {
        const stmt = this.db.prepare(`
            INSERT INTO users (id, email, password_hash, salt)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(id, email, passwordHash, salt);
    }

    checkPassword(email, password) {
        const user = this.getUser(email);
        if (!user) return false

        const hash = crypto.createHash('sha256')
            .update(password + user.salt)
            .digest('hex');

        return hash === user.passwordHash
    }
}