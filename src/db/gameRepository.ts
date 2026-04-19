import DatabaseConstructor from 'better-sqlite3';
import type { Game, GamePatch } from '../contracts/api';

type GameDBRow = {
    id: string;
    user_id: string;
    name: string;
    created_at: number;
    data: string;
};

export default class GameRepository {
    constructor(private db: ReturnType<typeof DatabaseConstructor>) {}

    private parseGame(data: string): Game | null {
        try {
            const parsed = JSON.parse(data) as Partial<Game>;

            if (
                typeof parsed.id !== 'string' ||
                typeof parsed.name !== 'string' ||
                !Array.isArray(parsed.cards) ||
                (parsed.turnTimeMode !== 'round' && parsed.turnTimeMode !== 'time')
            ) {
                return null;
            }

            return parsed as Game;
        } catch {
            return null;
        }
    }

    // ---------------- GET ----------------
    public getByUserId(userId: string): Game[] {
        const rows = this.db
            .prepare('SELECT * FROM games WHERE user_id = ?')
            .all(userId) as GameDBRow[];

        return rows
            .map(row => this.toDomain(row))
            .filter((game): game is Game => game !== null);
    }

    public getById(id: string, userId: string): Game | null {
        const row = this.db
            .prepare('SELECT * FROM games WHERE id = ? AND user_id = ?')
            .get(id, userId) as GameDBRow | undefined;

        return row ? this.toDomain(row) : null;
    }

    // ---------------- CREATE ----------------
    public create(userId: string, game: Game): Game {
        const createdAt = Date.now();

        this.db.prepare(`
            INSERT INTO games (id, user_id, name, created_at, data)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            game.id,
            userId,
            game.name,
            createdAt,
            JSON.stringify(game)
        );

        return game;
    }

    // ---------------- UPDATE ----------------
    public update(patch: GamePatch, userId: string): Game | null {
        const current = this.getById(patch.id, userId);

        if (!current) {
            return null;
        }

        const updated: Game = {
            ...current,
            ...patch
        };

        this.db.prepare(`
            UPDATE games
            SET
                name = ?,
                data = ?
            WHERE id = ? AND user_id = ?
        `).run(
            updated.name,
            JSON.stringify(updated),
            patch.id,
            userId
        );

        return updated;
    }

    // ---------------- DELETE ----------------
    public delete(id: string, userId: string): boolean {
        const result = this.db.prepare(`
            DELETE FROM games
            WHERE id = ? AND user_id = ?
        `).run(id, userId);

        return result.changes > 0;
    }

    // ---------------- MAPPER ----------------
    private toDomain(row: GameDBRow): Game | null {
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
