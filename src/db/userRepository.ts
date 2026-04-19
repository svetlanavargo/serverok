import DatabaseConstructor from 'better-sqlite3';

export type UserData = {
    currentGameId: string | null;
    activeCharacterId: string | null;
};

export interface User {
    id: string;
    email: string;
    passwordHash: string;
    salt: string;
    data: UserData | null;
}

interface UserRow {
    id: string;
    email: string;
    password_hash: string;
    salt: string;
    data: string | null;
}

function safeParse(data: string | null): UserData | null {
    if (!data) return null;

    try {
        return JSON.parse(data) as UserData;
    } catch {
        return null;
    }
}

export default class UserRepository {
    constructor(private db: ReturnType<typeof DatabaseConstructor>) {}

    public getUser(email: string): User | undefined {
        try {
            const row = this.db
                .prepare('SELECT * FROM users WHERE email = ?')
                .get(email);

            if (!row) return undefined;

            return this.mapRow(row as UserRow);
        } catch (error) {
            console.error('getUser error:', error);
            return undefined;
        }
    }

    public getUserById(id: string): User | undefined {
        try {
            const row = this.db
                .prepare('SELECT * FROM users WHERE id = ?')
                .get(id);

            if (!row) return undefined;

            return this.mapRow(row as UserRow);
        } catch (error) {
            console.error('getUserById error:', error);
            return undefined;
        }
    }

    public createUser(user: Omit<User, 'data'>): boolean {
        try {
            this.db.prepare(`
                INSERT INTO users (id, email, password_hash, salt, data)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                user.id,
                user.email,
                user.passwordHash,
                user.salt,
                null
            );

            return true;
        } catch (err) {
            console.error('createUser error:', err);
            return false;
        }
    }

    public updateUserData(userId: string, data: UserData): boolean {
        try {
            this.db.prepare(`
                UPDATE users
                SET data = ?
                WHERE id = ?
            `).run(JSON.stringify(data), userId);

            return true;
        } catch (err) {
            console.error('updateUserData error:', err);
            return false;
        }
    }

    private mapRow(row: UserRow): User {
        return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            salt: row.salt,
            data: safeParse(row.data)
        };
    }
}