const Database = require('better-sqlite3');
const UserRepository = require('../build/db/userRepository').default;
const GameRepository = require('../build/db/gameRepository').default;
const CharacterRepository = require('../build/db/characterRepository').default;
const SessionManager = require('../build/application/SessionManager').default;
const AuthController = require('../build/application/AuthController').default;
const WebServer = require('../build/application/WebServer').default;

function createSchema(db) {
    db.exec(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            data TEXT DEFAULT '{}'
        );

        CREATE TABLE characters (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            data TEXT NOT NULL
        );

        CREATE TABLE games (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            data TEXT NOT NULL
        );
    `);
}

function createController() {
    const db = new Database(':memory:');
    createSchema(db);

    return {
        db,
        users: new UserRepository(db),
        games: new GameRepository(db),
        characters: new CharacterRepository(db),
        sessions: new SessionManager(db),
        controller: new AuthController(
            new UserRepository(db),
            new GameRepository(db),
            new CharacterRepository(db),
            new SessionManager(db)
        )
    };
}

function createResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: '',
        setHeader(name, value) {
            this.headers[name] = value;
        },
        writeHead(statusCode, headers) {
            this.statusCode = statusCode;
            this.headers = {
                ...this.headers,
                ...(headers ?? {})
            };
        },
        end(payload) {
            this.body = payload ?? '';
        }
    };
}

function createAuthedRequest(sid) {
    return {
        headers: {
            cookie: `sid=${sid}`
        }
    };
}

describe('backend smoke', () => {
    test('game creation writes rows compatible with current schema', () => {
        const db = new Database(':memory:');
        createSchema(db);
        const games = new GameRepository(db);

        const created = games.create('user-1', {
            id: 'game-1',
            name: 'Session Zero',
            cards: [{
                id: 'card-1',
                name: 'Mob',
                ac: 12,
                currentHits: 8,
                maxHits: 8,
                initiativeBonus: 1,
                isPlayer: false,
                note: ''
            }],
            turnTimeMode: 'time'
        });

        expect(created.name).toBe('Session Zero');
        expect(created.cards).toHaveLength(1);

        const row = db.prepare('SELECT data FROM games WHERE id = ?').get('game-1');
        expect(JSON.parse(row.data)).toEqual({
            id: 'game-1',
            name: 'Session Zero',
            cards: [{
                id: 'card-1',
                name: 'Mob',
                ac: 12,
                currentHits: 8,
                maxHits: 8,
                initiativeBonus: 1,
                isPlayer: false,
                note: ''
            }],
            turnTimeMode: 'time'
        });
        db.close();
    });

    test('login returns generic error for unknown user', () => {
        const { db, controller } = createController();
        const res = createResponse();

        controller.handleLogin(
            { headers: {} },
            res,
            JSON.stringify({ email: 'missing@example.com', password: 'password123' })
        );

        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body)).toEqual({
            ok: false,
            error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid credentials'
            }
        });
        db.close();
    });

    test('get games returns only current user games', () => {
        const { db, games, sessions, controller } = createController();
        const sid = sessions.createSession('user-1');

        games.create('user-1', { id: 'game-1', name: 'Alpha', cards: [], turnTimeMode: 'round' });
        games.create('user-1', {
            id: 'game-2',
            name: 'Beta',
            cards: [{
                id: 'c1',
                name: 'Beta Mob',
                ac: 10,
                currentHits: 10,
                maxHits: 10,
                initiativeBonus: 0,
                isPlayer: false,
                note: ''
            }],
            turnTimeMode: 'time'
        });
        games.create('user-2', { id: 'game-3', name: 'Gamma', cards: [], turnTimeMode: 'round' });

        const res = createResponse();
        controller.handleGetGames(createAuthedRequest(sid), res);

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({
            ok: true,
            data: [
                { id: 'game-1', name: 'Alpha', cards: [], turnTimeMode: 'round' },
                { id: 'game-2', name: 'Beta', cards: [{ id: 'c1' }], turnTimeMode: 'time' }
            ]
        });
        db.close();
    });

    test('update game changes frontend game payload for current user only', () => {
        const { db, games, sessions, controller } = createController();
        const sid = sessions.createSession('user-1');

        games.create('user-1', {
            id: 'game-1',
            name: 'Before',
            cards: [],
            turnTimeMode: 'round'
        });

        const res = createResponse();
        controller.handleUpdateGame(
            createAuthedRequest(sid),
            res,
            JSON.stringify({
                id: 'game-1',
                name: 'After',
                cards: [{
                    id: 'card-2',
                    name: 'Updated Mob',
                    ac: 10,
                    currentHits: 10,
                    maxHits: 10,
                    initiativeBonus: 0,
                    isPlayer: false,
                    note: ''
                }],
                turnTimeMode: 'time'
            })
        );

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({
            ok: true,
            data: {
                id: 'game-1',
                name: 'After',
                cards: [{ id: 'card-2' }],
                turnTimeMode: 'time'
            }
        });
        expect(games.getById('game-1', 'user-1')).toMatchObject({
            name: 'After',
            cards: [{ id: 'card-2' }],
            turnTimeMode: 'time'
        });
        db.close();
    });

    test('update game accepts cards with empty names', () => {
        const { db, games, sessions, controller } = createController();
        const sid = sessions.createSession('user-1');

        games.create('user-1', {
            id: 'game-1',
            name: 'Before',
            cards: [],
            turnTimeMode: 'round'
        });

        const res = createResponse();
        controller.handleUpdateGame(
            createAuthedRequest(sid),
            res,
            JSON.stringify({
                id: 'game-1',
                cards: [{
                    id: 'card-empty-name',
                    name: '',
                    ac: 10,
                    currentHits: 10,
                    maxHits: 10,
                    initiativeBonus: 0,
                    isPlayer: false,
                    note: ''
                }]
            })
        );

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({
            ok: true,
            data: {
                id: 'game-1',
                cards: [{ id: 'card-empty-name', name: '' }]
            }
        });
        db.close();
    });

    test('update game accepts cards without name', () => {
        const { db, games, sessions, controller } = createController();
        const sid = sessions.createSession('user-1');

        games.create('user-1', {
            id: 'game-1',
            name: 'Before',
            cards: [],
            turnTimeMode: 'round'
        });

        const res = createResponse();
        controller.handleUpdateGame(
            createAuthedRequest(sid),
            res,
            JSON.stringify({
                id: 'game-1',
                cards: [{
                    id: 'card-no-name',
                    ac: 10,
                    currentHits: 10,
                    maxHits: 10,
                    initiativeBonus: 0,
                    isPlayer: false,
                    note: ''
                }]
            })
        );

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({
            ok: true,
            data: {
                id: 'game-1',
                cards: [{ id: 'card-no-name', name: '' }]
            }
        });
        db.close();
    });

    test('create game accepts frontend shape as-is', () => {
        const { db, sessions, controller } = createController();
        const sid = sessions.createSession('user-1');
        const res = createResponse();

        controller.handleCreateGame(
            createAuthedRequest(sid),
            res,
            JSON.stringify({
                id: 'game-front-1',
                name: 'Фронтовая игра',
                cards: [{
                    id: 'card-a',
                    name: '123123123123',
                    ac: 10,
                    currentHits: 10,
                    maxHits: 10,
                    initiativeBonus: 0,
                    isPlayer: false,
                    note: '',
                    color: undefined
                }],
                turnTimeMode: 'round'
            })
        );

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({
            ok: true,
            data: {
                id: 'game-front-1',
                name: 'Фронтовая игра',
                cards: [{
                    id: 'card-a',
                    name: '123123123123',
                    ac: 10,
                    currentHits: 10,
                    maxHits: 10,
                    initiativeBonus: 0,
                    isPlayer: false,
                    note: ''
                }],
                turnTimeMode: 'round'
            }
        });
        db.close();
    });

    test('create game accepts cards with empty names', () => {
        const { db, sessions, controller } = createController();
        const sid = sessions.createSession('user-1');
        const res = createResponse();

        controller.handleCreateGame(
            createAuthedRequest(sid),
            res,
            JSON.stringify({
                id: 'game-empty-card-name',
                name: 'No Card Name',
                cards: [{
                    id: 'card-empty-name',
                    name: '',
                    ac: 10,
                    currentHits: 10,
                    maxHits: 10,
                    initiativeBonus: 0,
                    isPlayer: false,
                    note: ''
                }],
                turnTimeMode: 'round'
            })
        );

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({
            ok: true,
            data: {
                id: 'game-empty-card-name',
                name: 'No Card Name',
                cards: [{
                    id: 'card-empty-name',
                    name: '',
                    ac: 10,
                    currentHits: 10,
                    maxHits: 10,
                    initiativeBonus: 0,
                    isPlayer: false,
                    note: ''
                }],
                turnTimeMode: 'round'
            }
        });
        db.close();
    });

    test('create game accepts cards without name', () => {
        const { db, sessions, controller } = createController();
        const sid = sessions.createSession('user-1');
        const res = createResponse();

        controller.handleCreateGame(
            createAuthedRequest(sid),
            res,
            JSON.stringify({
                id: 'game-no-card-name',
                name: 'No Card Name',
                cards: [{
                    id: 'card-no-name',
                    ac: 10,
                    currentHits: 10,
                    maxHits: 10,
                    initiativeBonus: 0,
                    isPlayer: false,
                    note: ''
                }],
                turnTimeMode: 'round'
            })
        );

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({
            ok: true,
            data: {
                id: 'game-no-card-name',
                name: 'No Card Name',
                cards: [{
                    id: 'card-no-name',
                    name: '',
                    ac: 10,
                    currentHits: 10,
                    maxHits: 10,
                    initiativeBonus: 0,
                    isPlayer: false,
                    note: ''
                }],
                turnTimeMode: 'round'
            }
        });
        db.close();
    });

    test('sessions survive manager re-instantiation', () => {
        const db = new Database(':memory:');
        createSchema(db);

        const firstManager = new SessionManager(db);
        const sid = firstManager.createSession('user-42');

        const secondManager = new SessionManager(db);
        expect(secondManager.getSession(sid)).toMatchObject({ userId: 'user-42' });
        db.close();
    });

    test('invalid character json is skipped instead of crashing reads', () => {
        const db = new Database(':memory:');
        createSchema(db);
        db.prepare(`
            INSERT INTO characters (id, user_id, data, created_at)
            VALUES (?, ?, ?, ?)
        `).run('broken', 'user-1', '{bad json', Date.now());

        const repo = new CharacterRepository(db);
        expect(repo.getByUserId('user-1')).toEqual([]);
        expect(repo.getById('broken', 'user-1')).toBeNull();
        db.close();
    });
});

describe('web server methods', () => {
    test('returns 405 when path exists but method is not allowed', async () => {
        const app = new WebServer(0);
        app.registerRoute('GET', '/resource', (_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ok');
        });

        const req = { method: 'DELETE', url: '/resource', headers: {} };
        const res = createResponse();

        await app.handleRequest(req, res);

        expect(res.statusCode).toBe(405);
        expect(res.headers.Allow).toBe('GET,OPTIONS');
        expect(res.body).toBe('Method not allowed');
    });

    test('returns 404 for unknown path', async () => {
        const app = new WebServer(0);
        app.registerRoute('GET', '/resource', (_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ok');
        });

        const req = { method: 'DELETE', url: '/missing', headers: {} };
        const res = createResponse();

        await app.handleRequest(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.body).toBe('Not found');
    });
});
