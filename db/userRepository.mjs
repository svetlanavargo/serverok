import crypto from 'node:crypto';

export default class UserRepository {
    constructor(database) {
        this.db = database;
    }

    getUser(email) {
        try {
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
        catch (err) {
            console.error('getUser error:', err);
            return undefined;
        }
    }

    saveUser({ id, email, passwordHash, salt }) {
        try {
            const stmt = this.db.prepare(`
            INSERT INTO users (id, email, password_hash, salt)
            VALUES (?, ?, ?, ?)
        `);
            stmt.run(id, email, passwordHash, salt);
        }
        catch (err) {
            console.error('saveUser error:', err);
            return false;
        }
    }

    checkPassword(email, password) {
        try {
            const user = this.getUser(email);
            if (!user) return false

            const hash = crypto.createHash('sha256')
                .update(password + user.salt)
                .digest('hex');

            return hash === user.passwordHash
        }
        catch (err) {
            console.error('checkPassword error:', err);
            return false;
        }
    }

    getAllUsers() {
        try {
            const stmt = this.db.prepare('SELECT * FROM users');
            const rows = stmt.all();
            return rows.map(row => ({
                id: row.id,
                email: row.email,
                passwordHash: row.password_hash,
                salt: row.salt
            }));
        } catch (err) {
            console.error('getAllUsers error:', err);
            return [];
        }
    }
}