import crypto from 'node:crypto';
import DatabaseConstructor from 'better-sqlite3';

interface User {
    id: string,
    email: string,
    passwordHash: string,
    salt: string
}

interface UserRow {
    id: string,
    email: string,
    password_hash: string,
    salt: string
}

export default class UserRepository {
    private db: ReturnType<typeof DatabaseConstructor>;

    constructor(database: ReturnType<typeof DatabaseConstructor>) {
        this.db = database;
    }

    getUser(email: string): User | undefined {
        try {
            const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
            const row = stmt.get(email) as UserRow | undefined;
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

    saveUser(user: User): boolean {
        try {
            const stmt = this.db.prepare(`
            INSERT INTO users (id, email, password_hash, salt)
            VALUES (?, ?, ?, ?)
        `);
            stmt.run(user.id, user.email, user.passwordHash, user.salt);
            return true;
        }
        catch (err) {
            console.error('saveUser error:', err);
            return false;
        }
    }

    checkPassword(email: string, password: string): boolean  {
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

    getAllUsers(): User[]  {
        try {
            const stmt = this.db.prepare('SELECT * FROM users');
            const rows = stmt.all() as UserRow[];
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