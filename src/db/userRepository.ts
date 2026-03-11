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

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isUserRow(value: unknown): value is UserRow {
    if (!isObject(value)) return false;

    return (
        typeof value.id === 'string' &&
        typeof value.email === 'string' &&
        typeof value.password_hash === 'string' &&
        typeof value.salt === 'string'
    );
}

export default class UserRepository {
    private db: ReturnType<typeof DatabaseConstructor>;

    constructor(database: ReturnType<typeof DatabaseConstructor>) {
        this.db = database;
    }

    public getUser(email: string): User | undefined {
        try {
            const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
            const row = stmt.get(email);

            if (!isUserRow(row)) {
                return undefined;
            }

            return {
                id: row.id,
                email: row.email,
                passwordHash: row.password_hash,
                salt: row.salt,
            };
        } catch (error) {
            console.error('Failed to get user:', error);
            return undefined;
        }
    }

    public saveUser(user: User): boolean {
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

    public getAllUsers(): User[] | undefined  {
        try {
            const stmt = this.db.prepare('SELECT * FROM users');
            const rows = stmt.all();

            if (!rows.every(isUserRow)) {
                return undefined;
            }

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