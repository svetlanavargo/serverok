"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = __importDefault(require("node:crypto"));
const config_1 = require("../config");
class SessionManager {
    constructor(db) {
        this.db = db;
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            )
        `);
    }
    createSession(userId, ttlMs = config_1.SESSION_TTL_MS) {
        const sid = node_crypto_1.default.randomBytes(24).toString('hex');
        const createdAt = Date.now();
        const expiresAt = createdAt + ttlMs;
        this.db.prepare(`
            INSERT INTO sessions (sid, user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(sid, userId, createdAt, expiresAt);
        return sid;
    }
    getSession(sid) {
        const row = this.db.prepare(`
            SELECT user_id, created_at, expires_at
            FROM sessions
            WHERE sid = ?
        `).get(sid);
        if (!row)
            return undefined;
        if (Date.now() > row.expires_at) {
            this.destroySession(sid);
            return undefined;
        }
        return {
            userId: row.user_id,
            createdAt: row.created_at,
            expiresAt: row.expires_at
        };
    }
    destroySession(sid) {
        this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    }
    getSidFromCookie(cookieHeader) {
        if (!cookieHeader)
            return undefined;
        const match = cookieHeader.match(/sid=([^;]+)/);
        return match === null || match === void 0 ? void 0 : match[1];
    }
    getUserIdFromCookie(cookieHeader) {
        const sid = this.getSidFromCookie(cookieHeader);
        if (!sid)
            return undefined;
        const session = this.getSession(sid);
        return session === null || session === void 0 ? void 0 : session.userId;
    }
    cleanup() {
        this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    }
}
exports.default = SessionManager;
