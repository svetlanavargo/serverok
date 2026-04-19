"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = __importDefault(require("node:crypto"));
const config_1 = require("../config");
const errors_1 = require("../errors");
class AuthController {
    constructor(users, games, characters, sessions) {
        this.users = users;
        this.games = games;
        this.characters = characters;
        this.sessions = sessions;
        // ---------------- ROOT ----------------
        this.handleRoot = (_req, res) => {
            this.success(res, {
                service: 'dnd-backend',
                status: 'healthy'
            });
        };
        // ---------------- REGISTER ----------------
        this.handleRegister = (_req, res, body) => {
            const credentials = this.parseCredentials(body);
            if (!credentials) {
                return this.failure(res, 400, errors_1.ERROR_CODES.MISSING_FIELDS, 'Missing fields');
            }
            const { email, password } = credentials;
            if (!this.validateEmail(email)) {
                return this.failure(res, 400, errors_1.ERROR_CODES.INVALID_EMAIL, 'Invalid email');
            }
            if (password.length < 8) {
                return this.failure(res, 400, errors_1.ERROR_CODES.PASSWORD_TOO_SHORT, 'Password too short');
            }
            if (this.users.getUser(email)) {
                return this.failure(res, 409, errors_1.ERROR_CODES.USER_ALREADY_EXISTS, 'User already exists');
            }
            const salt = node_crypto_1.default.randomBytes(16).toString('hex');
            this.users.createUser({
                id: node_crypto_1.default.randomUUID(),
                email,
                salt,
                passwordHash: this.createPasswordHash(password, salt)
            });
            return this.success(res);
        };
        // ---------------- LOGIN ----------------
        this.handleLogin = (_req, res, body) => {
            const credentials = this.parseCredentials(body);
            if (!credentials) {
                return this.failure(res, 400, errors_1.ERROR_CODES.MISSING_CREDENTIALS, 'Missing credentials');
            }
            const { email, password } = credentials;
            const user = this.users.getUser(email);
            if (!user || !this.verifyPassword(password, user)) {
                return this.failure(res, 401, errors_1.ERROR_CODES.INVALID_CREDENTIALS, 'Invalid credentials');
            }
            const sid = this.sessions.createSession(user.id);
            const safeUser = {
                id: user.id,
                email: user.email
            };
            return this.respondWithSession(res, sid, safeUser);
        };
        // ---------------- LOGOUT ----------------
        this.handleLogout = (req, res) => {
            const sid = this.sessions.getSidFromCookie(req.headers.cookie);
            if (sid) {
                this.sessions.destroySession(sid);
            }
            return this.clearSessionCookie(res);
        };
        // ---------------- ME ----------------
        this.handleMe = (req, res) => {
            const session = this.getSessionOrFail(req, res);
            if (!session)
                return;
            const user = this.users.getUserById(session.userId);
            const safeUser = user
                ? { id: user.id, email: user.email }
                : null;
            return this.success(res, { user: safeUser });
        };
        // ---------------- GAMES ----------------
        this.handleCreateGame = (req, res, body) => {
            const session = this.getSessionOrFail(req, res);
            if (!session)
                return;
            const game = this.sanitizeGameInput(this.parseBody(body));
            if (!game) {
                return this.failure(res, 400, errors_1.ERROR_CODES.INVALID_GAME_PAYLOAD, 'Invalid game payload');
            }
            return this.success(res, this.games.create(session.userId, game));
        };
        this.handleGetGames = (req, res) => {
            const session = this.getSessionOrFail(req, res);
            if (!session)
                return;
            const games = this.games.getByUserId(session.userId);
            return this.success(res, games);
        };
        this.handleUpdateGame = (req, res, body) => {
            const session = this.getSessionOrFail(req, res);
            if (!session)
                return;
            const patch = this.sanitizeGamePatch(this.parseBody(body));
            if (!patch) {
                return this.failure(res, 400, errors_1.ERROR_CODES.INVALID_PAYLOAD, 'Invalid payload');
            }
            const updated = this.games.update(patch, session.userId);
            if (!updated) {
                return this.failure(res, 404, errors_1.ERROR_CODES.GAME_NOT_FOUND, 'Game not found');
            }
            return this.success(res, updated);
        };
        this.handleDeleteGame = (req, res, body) => {
            const session = this.getSessionOrFail(req, res);
            if (!session)
                return;
            const parsed = this.parseBody(body);
            const id = this.getEntityId(parsed);
            if (!id) {
                return this.failure(res, 400, errors_1.ERROR_CODES.MISSING_ID, 'Missing id');
            }
            const success = this.games.delete(id, session.userId);
            if (!success) {
                return this.failure(res, 404, errors_1.ERROR_CODES.GAME_NOT_FOUND, 'Game not found');
            }
            return this.success(res);
        };
        // ---------------- CHARACTERS ----------------
        this.handleCreateCharacter = (req, res, body) => {
            const session = this.getSessionOrFail(req, res);
            if (!session)
                return;
            const parsed = this.parseBody(body);
            const characterInput = this.sanitizeCharacterInput(parsed);
            if (!characterInput) {
                return this.failure(res, 400, errors_1.ERROR_CODES.INVALID_CHARACTER_PAYLOAD, 'Invalid character payload');
            }
            const character = Object.assign(Object.assign({}, characterInput), { id: this.isNonEmptyString(characterInput.id)
                    ? characterInput.id.trim()
                    : node_crypto_1.default.randomUUID() });
            const saved = this.characters.create(character, session.userId);
            return this.success(res, saved);
        };
        this.handleGetCharacters = (req, res) => {
            const session = this.getSessionOrFail(req, res);
            if (!session)
                return;
            const characters = this.characters.getByUserId(session.userId);
            return this.success(res, characters);
        };
        this.handleUpdateCharacter = (req, res, body) => {
            const session = this.getSessionOrFail(req, res);
            if (!session)
                return;
            const parsed = this.parseBody(body);
            const patch = this.sanitizeCharacterPatch(parsed);
            if (!patch) {
                return this.failure(res, 400, errors_1.ERROR_CODES.INVALID_PAYLOAD, 'Invalid payload');
            }
            const updated = this.characters.update(patch.id, session.userId, patch);
            if (!updated) {
                return this.failure(res, 404, errors_1.ERROR_CODES.CHARACTER_NOT_FOUND, 'Character not found');
            }
            return this.success(res, updated);
        };
        this.handleDeleteCharacter = (req, res, body) => {
            const session = this.getSessionOrFail(req, res);
            if (!session)
                return;
            const parsed = this.parseBody(body);
            const id = this.getEntityId(parsed);
            if (!id) {
                return this.failure(res, 400, errors_1.ERROR_CODES.MISSING_ID, 'Missing id');
            }
            const success = this.characters.delete(id, session.userId);
            if (!success) {
                return this.failure(res, 404, errors_1.ERROR_CODES.CHARACTER_NOT_FOUND, 'Character not found');
            }
            return this.success(res);
        };
    }
    // ---------------- UTIL ----------------
    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    }
    createPasswordHash(password, salt) {
        return `scrypt$${node_crypto_1.default.scryptSync(password, salt, 64).toString('hex')}`;
    }
    verifyPassword(password, user) {
        if (user.passwordHash.startsWith('scrypt$')) {
            const storedHash = user.passwordHash.slice('scrypt$'.length);
            const expected = Buffer.from(storedHash, 'hex');
            const actual = node_crypto_1.default.scryptSync(password, user.salt, expected.length);
            return actual.length === expected.length &&
                node_crypto_1.default.timingSafeEqual(actual, expected);
        }
        const legacyHash = node_crypto_1.default
            .createHash('sha256')
            .update(password + user.salt)
            .digest();
        const stored = Buffer.from(user.passwordHash, 'hex');
        return legacyHash.length === stored.length &&
            node_crypto_1.default.timingSafeEqual(legacyHash, stored);
    }
    parseBody(body) {
        try {
            return typeof body === 'string' ? JSON.parse(body) : body;
        }
        catch (_a) {
            return null;
        }
    }
    parseCredentials(body) {
        const parsed = this.parseBody(body);
        if (!parsed ||
            typeof parsed !== 'object' ||
            !this.isNonEmptyString(parsed.email) ||
            !this.isNonEmptyString(parsed.password)) {
            return null;
        }
        return {
            email: parsed.email.trim(),
            password: parsed.password
        };
    }
    getSessionOrFail(req, res) {
        const sid = this.sessions.getSidFromCookie(req.headers.cookie);
        const session = sid ? this.sessions.getSession(sid) : null;
        if (!session) {
            this.failure(res, 401, errors_1.ERROR_CODES.UNAUTHORIZED, 'Unauthorized');
            return null;
        }
        return session;
    }
    json(res, status, body) {
        res.writeHead(status, {
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(body));
    }
    success(res, data = null) {
        this.json(res, 200, { ok: true, data });
    }
    failure(res, status, code, message = code) {
        const error = { code, message };
        this.json(res, status, { ok: false, error });
    }
    getCookieHeader(sid, maxAgeSeconds) {
        const baseCookie = `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
        return process.env.NODE_ENV === 'production'
            ? `${baseCookie}; Secure`
            : baseCookie;
    }
    clearSessionCookie(res) {
        res.writeHead(200, {
            'Set-Cookie': this.getCookieHeader('', 0),
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ ok: true, data: null }));
    }
    respondWithSession(res, sid, user) {
        res.writeHead(200, {
            'Set-Cookie': this.getCookieHeader(sid, config_1.SESSION_MAX_AGE_SECONDS),
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({
            ok: true,
            data: { user }
        }));
    }
    isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }
    getEntityId(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        const { id } = parsed;
        return this.isNonEmptyString(id) ? id.trim() : null;
    }
    sanitizeCharacterInput(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        const candidate = parsed;
        if (!this.isNonEmptyString(candidate.name) || !this.isNonEmptyString(candidate.class)) {
            return null;
        }
        return Object.assign(Object.assign({}, candidate), { name: candidate.name.trim(), class: candidate.class.trim() });
    }
    sanitizeCharacterPatch(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        const candidate = Object.assign({}, parsed);
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
        return candidate;
    }
    sanitizeGameCard(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const candidate = value;
        if (!this.isNonEmptyString(candidate.id) || !this.isNonEmptyString(candidate.name)) {
            return null;
        }
        if (typeof candidate.ac !== 'number' ||
            typeof candidate.currentHits !== 'number' ||
            typeof candidate.maxHits !== 'number' ||
            typeof candidate.initiativeBonus !== 'number' ||
            typeof candidate.isPlayer !== 'boolean') {
            return null;
        }
        if (typeof candidate.note !== 'string') {
            return null;
        }
        if ('color' in candidate &&
            candidate.color !== undefined &&
            typeof candidate.color !== 'string') {
            return null;
        }
        return Object.assign({ id: candidate.id.trim(), name: candidate.name.trim(), ac: candidate.ac, currentHits: candidate.currentHits, maxHits: candidate.maxHits, initiativeBonus: candidate.initiativeBonus, isPlayer: candidate.isPlayer, note: candidate.note }, (typeof candidate.color === 'string' ? { color: candidate.color } : {}));
    }
    sanitizeGameCards(value) {
        if (!Array.isArray(value)) {
            return null;
        }
        const cards = [];
        for (const item of value) {
            const card = this.sanitizeGameCard(item);
            if (!card) {
                return null;
            }
            cards.push(card);
        }
        return cards;
    }
    sanitizeGameInput(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        const candidate = parsed;
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
                : node_crypto_1.default.randomUUID(),
            name: candidate.name.trim(),
            cards,
            turnTimeMode
        };
    }
    sanitizeGamePatch(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        const candidate = parsed;
        if (!this.isNonEmptyString(candidate.id)) {
            return null;
        }
        const patch = {
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
}
exports.default = AuthController;
