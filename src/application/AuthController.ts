import { RouteHandler } from './WebServer';
import SessionManager from './SessionManager';
import UserRepository from '../db/userRepository';
import GameRepository from '../db/gameRepository';
import type {
    ApiError,
    Game,
    GameCard,
    GamePatch,
    SafeUser
} from '../contracts/api';
import CharacterRepository from '../db/characterRepository';
import crypto from 'node:crypto';
import * as http from 'node:http';
import { SESSION_MAX_AGE_SECONDS } from '../config';
import { ERROR_CODES } from '../errors';

type CharacterInput = Record<string, unknown> & {
    name: string;
    class: string;
    id?: string;
};

type CharacterPatch = Record<string, unknown> & {
    id: string;
};

type Credentials = {
    email: string;
    password: string;
};

export default class AuthController {
    constructor(
        private users: UserRepository,
        private games: GameRepository,
        private characters: CharacterRepository,
        private sessions: SessionManager
    ) {}

    // ---------------- UTIL ----------------

    private validateEmail(email: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    }

    private createPasswordHash(password: string, salt: string) {
        return `scrypt$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
    }

    private verifyPassword(password: string, user: { salt: string; passwordHash: string }) {
        if (user.passwordHash.startsWith('scrypt$')) {
            const storedHash = user.passwordHash.slice('scrypt$'.length);
            const expected = Buffer.from(storedHash, 'hex');
            const actual = crypto.scryptSync(password, user.salt, expected.length);

            return actual.length === expected.length &&
                crypto.timingSafeEqual(actual, expected);
        }

        const legacyHash = crypto
            .createHash('sha256')
            .update(password + user.salt)
            .digest();
        const stored = Buffer.from(user.passwordHash, 'hex');

        return legacyHash.length === stored.length &&
            crypto.timingSafeEqual(legacyHash, stored);
    }

    private parseBody(body?: string): unknown {
        try {
            return typeof body === 'string' ? JSON.parse(body) : body;
        } catch {
            return null;
        }
    }

    private parseCredentials(body?: string): Credentials | null {
        const parsed = this.parseBody(body);

        if (
            !parsed ||
            typeof parsed !== 'object' ||
            !this.isNonEmptyString((parsed as Record<string, unknown>).email) ||
            !this.isNonEmptyString((parsed as Record<string, unknown>).password)
        ) {
            return null;
        }

        return {
            email: (parsed as Record<string, string>).email.trim(),
            password: (parsed as Record<string, string>).password
        };
    }

    private getSessionOrFail(req: http.IncomingMessage, res: http.ServerResponse) {
        const sid = this.sessions.getSidFromCookie(req.headers.cookie);
        const session = sid ? this.sessions.getSession(sid) : null;

        if (!session) {
            this.failure(res, 401, ERROR_CODES.UNAUTHORIZED, 'Unauthorized');
            return null;
        }

        return session;
    }

    private json(res: http.ServerResponse, status: number, body: unknown) {
        res.writeHead(status, {
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(body));
    }

    private success(res: http.ServerResponse, data: unknown = null) {
        this.json(res, 200, { ok: true, data });
    }

    private failure(
        res: http.ServerResponse,
        status: number,
        code: string,
        message: string = code
    ) {
        const error: ApiError = { code, message };
        this.json(res, status, { ok: false, error });
    }

    private getCookieHeader(sid: string, maxAgeSeconds: number) {
        const baseCookie = `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
        return process.env.NODE_ENV === 'production'
            ? `${baseCookie}; Secure`
            : baseCookie;
    }

    private clearSessionCookie(res: http.ServerResponse) {
        res.writeHead(200, {
            'Set-Cookie': this.getCookieHeader('', 0),
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ ok: true, data: null }));
    }

    private respondWithSession(
        res: http.ServerResponse,
        sid: string,
        user: SafeUser
    ) {
        res.writeHead(200, {
            'Set-Cookie': this.getCookieHeader(sid, SESSION_MAX_AGE_SECONDS),
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({
            ok: true,
            data: { user }
        }));
    }

    private isNonEmptyString(value: unknown): value is string {
        return typeof value === 'string' && value.trim().length > 0;
    }

    private getEntityId(parsed: unknown): string | null {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const { id } = parsed as Record<string, unknown>;
        return this.isNonEmptyString(id) ? id.trim() : null;
    }

    private sanitizeCharacterInput(parsed: unknown): CharacterInput | null {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const candidate = parsed as Record<string, unknown>;

        if (!this.isNonEmptyString(candidate.name) || !this.isNonEmptyString(candidate.class)) {
            return null;
        }

        return {
            ...candidate,
            name: candidate.name.trim(),
            class: candidate.class.trim()
        };
    }

    private sanitizeCharacterPatch(parsed: unknown): CharacterPatch | null {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const candidate = { ...(parsed as Record<string, unknown>) };
        delete candidate.userId;
        delete candidate.createdAt;

        if (!this.isNonEmptyString(candidate.id)) {
            return null;
        }

        candidate.id = candidate.id.trim();

        if ('name' in candidate && !this.isNonEmptyString(candidate.name)) {
            return null;
        }

        if ('class' in candidate && !this.isNonEmptyString(candidate.class)) {
            return null;
        }

        if (typeof candidate.name === 'string') {
            candidate.name = candidate.name.trim();
        }

        if (typeof candidate.class === 'string') {
            candidate.class = candidate.class.trim();
        }

        return candidate as CharacterPatch;
    }

    private sanitizeGameCard(value: unknown): GameCard | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }

        const candidate = value as Record<string, unknown>;

        if (!this.isNonEmptyString(candidate.id)) {
            return null;
        }

        if ('name' in candidate && typeof candidate.name !== 'string') {
            return null;
        }

        if (
            typeof candidate.ac !== 'number' ||
            typeof candidate.currentHits !== 'number' ||
            typeof candidate.maxHits !== 'number' ||
            typeof candidate.initiativeBonus !== 'number' ||
            typeof candidate.isPlayer !== 'boolean'
        ) {
            return null;
        }

        if (typeof candidate.note !== 'string') {
            return null;
        }

        if (
            'color' in candidate &&
            candidate.color !== null &&
            candidate.color !== undefined &&
            typeof candidate.color !== 'string'
        ) {
            return null;
        }

        return {
            id: candidate.id.trim(),
            name: typeof candidate.name === 'string' ? candidate.name.trim() : '',
            ac: candidate.ac,
            currentHits: candidate.currentHits,
            maxHits: candidate.maxHits,
            initiativeBonus: candidate.initiativeBonus,
            isPlayer: candidate.isPlayer,
            note: candidate.note,
            ...(typeof candidate.color === 'string' ? { color: candidate.color } : {})
        };
    }

    private explainInvalidGamePatch(parsed: unknown): string {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return 'Payload must be a JSON object';
        }

        const candidate = parsed as Record<string, unknown>;

        if (!this.isNonEmptyString(candidate.id)) {
            return 'Field "id" is required';
        }

        if ('name' in candidate && !this.isNonEmptyString(candidate.name)) {
            return 'Field "name" must be a non-empty string';
        }

        if ('cards' in candidate) {
            if (!Array.isArray(candidate.cards)) {
                return 'Field "cards" must be an array';
            }

            for (const item of candidate.cards) {
                if (!this.sanitizeGameCard(item)) {
                    return 'Field "cards" contains an invalid card';
                }
            }
        }

        if (
            'turnTimeMode' in candidate &&
            candidate.turnTimeMode !== 'round' &&
            candidate.turnTimeMode !== 'time'
        ) {
            return 'Field "turnTimeMode" must be "round" or "time"';
        }

        if (
            !('name' in candidate) &&
            !('cards' in candidate) &&
            !('turnTimeMode' in candidate)
        ) {
            return 'Payload must include at least one of: name, cards, turnTimeMode';
        }

        return 'Invalid payload';
    }

    private sanitizeGameCards(value: unknown): GameCard[] | null {
        if (!Array.isArray(value)) {
            return null;
        }

        const cards: GameCard[] = [];

        for (const item of value) {
            const card = this.sanitizeGameCard(item);
            if (!card) {
                return null;
            }

            cards.push(card);
        }

        return cards;
    }

    private sanitizeGameInput(parsed: unknown): Game | null {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const candidate = parsed as Record<string, unknown>;

        if (!this.isNonEmptyString(candidate.name)) {
            return null;
        }

        const cards = this.sanitizeGameCards(candidate.cards);
        if (!cards) {
            return null;
        }

        const turnTimeMode = candidate.turnTimeMode === 'time' ? 'time' : 'round';

        return {
            id: this.isNonEmptyString(candidate.id)
                ? candidate.id.trim()
                : crypto.randomUUID(),
            name: candidate.name.trim(),
            cards,
            turnTimeMode
        };
    }

    private sanitizeGamePatch(parsed: unknown): GamePatch | null {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const candidate = parsed as Record<string, unknown>;

        if (!this.isNonEmptyString(candidate.id)) {
            return null;
        }

        const patch: GamePatch = {
            id: candidate.id.trim()
        };

        if ('name' in candidate) {
            if (!this.isNonEmptyString(candidate.name)) {
                return null;
            }

            patch.name = candidate.name.trim();
        }

        if ('cards' in candidate) {
            const cards = this.sanitizeGameCards(candidate.cards);
            if (!cards) {
                return null;
            }

            patch.cards = cards;
        }

        if ('turnTimeMode' in candidate) {
            if (candidate.turnTimeMode !== 'round' && candidate.turnTimeMode !== 'time') {
                return null;
            }

            patch.turnTimeMode = candidate.turnTimeMode;
        }

        if (!patch.name && !patch.cards && !patch.turnTimeMode) {
            return null;
        }

        return patch;
    }

    // ---------------- ROOT ----------------

    public handleRoot: RouteHandler = (_req, res) => {
        this.success(res, {
            service: 'dnd-backend',
            status: 'healthy'
        });
    };

    // ---------------- REGISTER ----------------

    public handleRegister: RouteHandler = (_req, res, body) => {
        const credentials = this.parseCredentials(body);

        if (!credentials) {
            return this.failure(res, 400, ERROR_CODES.MISSING_FIELDS, 'Missing fields');
        }

        const { email, password } = credentials;

        if (!this.validateEmail(email)) {
            return this.failure(res, 400, ERROR_CODES.INVALID_EMAIL, 'Invalid email');
        }

        if (password.length < 8) {
            return this.failure(res, 400, ERROR_CODES.PASSWORD_TOO_SHORT, 'Password too short');
        }

        if (this.users.getUser(email)) {
            return this.failure(res, 409, ERROR_CODES.USER_ALREADY_EXISTS, 'User already exists');
        }

        const salt = crypto.randomBytes(16).toString('hex');

        this.users.createUser({
            id: crypto.randomUUID(),
            email,
            salt,
            passwordHash: this.createPasswordHash(password, salt)
        });

        return this.success(res);
    };

    // ---------------- LOGIN ----------------

    public handleLogin: RouteHandler = (_req, res, body) => {
        const credentials = this.parseCredentials(body);

        if (!credentials) {
            return this.failure(res, 400, ERROR_CODES.MISSING_CREDENTIALS, 'Missing credentials');
        }

        const { email, password } = credentials;

        const user = this.users.getUser(email);

        if (!user || !this.verifyPassword(password, user)) {
            return this.failure(res, 401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid credentials');
        }

        const sid = this.sessions.createSession(user.id);
        const safeUser: SafeUser = {
            id: user.id,
            email: user.email
        };

        return this.respondWithSession(res, sid, safeUser);
    };

    // ---------------- LOGOUT ----------------

    public handleLogout: RouteHandler = (req, res) => {
        const sid = this.sessions.getSidFromCookie(req.headers.cookie);

        if (sid) {
            this.sessions.destroySession(sid);
        }

        return this.clearSessionCookie(res);
    };

    // ---------------- ME ----------------

    public handleMe: RouteHandler = (req, res) => {
        const session = this.getSessionOrFail(req, res);
        if (!session) return;

        const user = this.users.getUserById(session.userId);

        const safeUser: SafeUser | null = user
            ? { id: user.id, email: user.email }
            : null;

        return this.success(res, { user: safeUser });
    };

    // ---------------- GAMES ----------------

    public handleCreateGame: RouteHandler = (req, res, body) => {
        const session = this.getSessionOrFail(req, res);
        if (!session) return;

        const game = this.sanitizeGameInput(this.parseBody(body));
        if (!game) {
            return this.failure(res, 400, ERROR_CODES.INVALID_GAME_PAYLOAD, 'Invalid game payload');
        }

        return this.success(res, this.games.create(session.userId, game));
    };

    public handleGetGames: RouteHandler = (req, res) => {
        const session = this.getSessionOrFail(req, res);
        if (!session) return;

        const games = this.games.getByUserId(session.userId);

        return this.success(res, games);
    };

    public handleUpdateGame: RouteHandler = (req, res, body) => {
        const session = this.getSessionOrFail(req, res);
        if (!session) return;

        const parsed = this.parseBody(body);
        const patch = this.sanitizeGamePatch(parsed);
        if (!patch) {
            const reason = this.explainInvalidGamePatch(parsed);
            console.error('Invalid game update payload:', reason, parsed);
            return this.failure(res, 400, ERROR_CODES.INVALID_PAYLOAD, reason);
        }

        const updated = this.games.update(patch, session.userId);
        if (!updated) {
            return this.failure(res, 404, ERROR_CODES.GAME_NOT_FOUND, 'Game not found');
        }

        return this.success(res, updated);
    };

    public handleDeleteGame: RouteHandler = (req, res, body) => {
        const session = this.getSessionOrFail(req, res);
        if (!session) return;

        const parsed = this.parseBody(body);
        const id = this.getEntityId(parsed);

        if (!id) {
            return this.failure(res, 400, ERROR_CODES.MISSING_ID, 'Missing id');
        }

        const success = this.games.delete(id, session.userId);

        if (!success) {
            return this.failure(res, 404, ERROR_CODES.GAME_NOT_FOUND, 'Game not found');
        }

        return this.success(res);
    };

    // ---------------- CHARACTERS ----------------

    public handleCreateCharacter: RouteHandler = (req, res, body) => {
        const session = this.getSessionOrFail(req, res);
        if (!session) return;

        const parsed = this.parseBody(body);

        const characterInput = this.sanitizeCharacterInput(parsed);
        if (!characterInput) {
            return this.failure(res, 400, ERROR_CODES.INVALID_CHARACTER_PAYLOAD, 'Invalid character payload');
        }

        const character = {
            ...characterInput,
            id: this.isNonEmptyString(characterInput.id)
                ? characterInput.id.trim()
                : crypto.randomUUID()
        };

        const saved = this.characters.create(character, session.userId);

        return this.success(res, saved);
    };
    public handleGetCharacters: RouteHandler = (req, res) => {
        const session = this.getSessionOrFail(req, res);
        if (!session) return;

        const characters = this.characters.getByUserId(session.userId);

        return this.success(res, characters);
    };

    public handleUpdateCharacter: RouteHandler = (req, res, body) => {
        const session = this.getSessionOrFail(req, res);
        if (!session) return;

        const parsed = this.parseBody(body);
        const patch = this.sanitizeCharacterPatch(parsed);

        if (!patch) {
            return this.failure(res, 400, ERROR_CODES.INVALID_PAYLOAD, 'Invalid payload');
        }

        const updated = this.characters.update(
            patch.id,
            session.userId,
            patch
        );

        if (!updated) {
            return this.failure(res, 404, ERROR_CODES.CHARACTER_NOT_FOUND, 'Character not found');
        }

        return this.success(res, updated);
    };

    public handleDeleteCharacter: RouteHandler = (req, res, body) => {
        const session = this.getSessionOrFail(req, res);
        if (!session) return;

        const parsed = this.parseBody(body);
        const id = this.getEntityId(parsed);

        if (!id) {
            return this.failure(res, 400, ERROR_CODES.MISSING_ID, 'Missing id');
        }

        const success = this.characters.delete(id, session.userId);

        if (!success) {
            return this.failure(res, 404, ERROR_CODES.CHARACTER_NOT_FOUND, 'Character not found');
        }

        return this.success(res);
    };

}
