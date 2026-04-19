import DatabaseConstructor from 'better-sqlite3';

export type Character = any; // фронтовый объект

type CharacterRow = {
    id: string;
    user_id: string;
    data: string;
    created_at: number;
};

export default class CharacterRepository {
    constructor(private db: ReturnType<typeof DatabaseConstructor>) {}

    private parseCharacter(data: string): Character | null {
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    // ---------------- GET ALL ----------------
    public getByUserId(userId: string): Character[] {
        const rows = this.db
            .prepare('SELECT * FROM characters WHERE user_id = ?')
            .all(userId) as CharacterRow[];

        return rows
            .map(r => this.parseCharacter(r.data))
            .filter((character): character is Character => character !== null);
    }

    // ---------------- GET ONE ----------------
    public getById(id: string, userId: string): Character | null {
        const row = this.db
            .prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?')
            .get(id, userId) as CharacterRow | undefined;

        if (!row) return null;

        return this.parseCharacter(row.data);
    }

    // ---------------- CREATE ----------------
    public create(character: Character, userId: string): Character {
        const createdAt = Date.now();

        const stored = {
            ...character,
            id: character.id,
            createdAt
        };

        this.db.prepare(`
            INSERT INTO characters (id, user_id, data, created_at)
            VALUES (?, ?, ?, ?)
        `).run(
            character.id,
            userId,
            JSON.stringify(stored),
            createdAt
        );

        return stored;
    }

    // ---------------- UPDATE (PATCH MERGE) ----------------
    public update(
        id: string,
        userId: string,
        patch: Partial<Character>
    ): Character | null {
        const current = this.getById(id, userId);
        if (!current) return null;

        const updated = {
            ...current,
            ...patch,
            id: current.id,
            createdAt: current.createdAt
        };

        this.db.prepare(`
            UPDATE characters
            SET data = ?
            WHERE id = ? AND user_id = ?
        `).run(
            JSON.stringify(updated),
            id,
            userId
        );

        return updated;
    }

    // ---------------- DELETE ----------------
    public delete(id: string, userId: string): boolean {
        const result = this.db.prepare(`
            DELETE FROM characters
            WHERE id = ? AND user_id = ?
        `).run(id, userId);

        return result.changes > 0;
    }
}
