import crypto from 'node:crypto';

interface SessionData {
    email: string;
    expiresAt: number;
}

export default class SessionManager {
    private sessions: Record<string, SessionData> = {};

    createSession(email: string, ttlMs: number = 3600 * 1000): string {
        const sid = crypto.randomBytes(24).toString('hex');
        this.sessions[sid] = { email, expiresAt: Date.now() + ttlMs };
        return sid;
    }

    getSession(sid: string): SessionData | undefined {
        const session = this.sessions[sid];
        if (!session) return undefined;
        if (Date.now() > session.expiresAt) {
            delete this.sessions[sid];
            return undefined;
        }
        return session;
    }

    destroySession(sid: string) {
        delete this.sessions[sid];
    }

    getSidFromCookie(cookieHeader?: string): string | undefined {
        if (!cookieHeader) return undefined;
        const match = cookieHeader.match(/sid=([^;]+)/);
        return match?.[1];
    }
}