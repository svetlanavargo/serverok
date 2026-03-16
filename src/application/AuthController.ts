import { RouteHandler } from './WebServer';
import { FormRenderer } from './FormRenderer';
import SessionManager from './SessionManager';
import UserRepository from '../db/userRepository';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

export default class AuthController {
    constructor(
        private users: UserRepository,
        private sessions: SessionManager,
        private formRenderer: FormRenderer
    ) {}

    private validateEmail(email: string) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        return emailRegex.test(email);
    }

    private createPasswordHash(password: string, salt: string) {
        return crypto.createHash('sha256').update(password + salt).digest('hex');
    }

    public authRequired(handler: RouteHandler): RouteHandler {
        return (req, res, body) => {
            const sid = this.sessions.getSidFromCookie(req.headers.cookie);
            if (!sid || !this.sessions.getSession(sid)) {
                res.writeHead(303, { Location: '/login' });
                res.end();
                return;
            }
            handler(req, res, body);
        };
    }

    public showRegisterForm: RouteHandler = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.formRenderer.renderForm('register'));
    };

    public showLoginForm: RouteHandler = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.formRenderer.renderForm('login'));
    };

    public handleRegister: RouteHandler = (req, res, body) => {
        const params = new URLSearchParams(body);
        const email = params.get('email')!;
        const password = params.get('password')!;

        if (!this.validateEmail(email)) {
            res.writeHead(400);
            res.end(this.formRenderer.renderForm('register', 'Неверный email'));
            return;
        }

        if (password.length < 8) {
            res.writeHead(400);
            res.end(this.formRenderer.renderForm('register', 'Пароль должен быть не менее 8 символов'));
            return;
        }

        if (this.users.getUser(email)) {
            res.writeHead(409);
            res.end(this.formRenderer.renderForm('register', 'Email уже зарегистрирован'));
            return;
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = this.createPasswordHash(password, salt);
        this.users.saveUser({ id: crypto.randomUUID(), email, salt, passwordHash });

        res.writeHead(303, { Location: '/login' });
        res.end();
    };

    public handleRoot: RouteHandler = (req, res) => {
        res.writeHead(303, { Location: '/dice' });
        res.end();
    }

    public handleLogin: RouteHandler = (req, res, body) => {
        const params = new URLSearchParams(body);
        const email = params.get('email')!;
        const password = params.get('password')!;

        const user = this.users.getUser(email);
        if (!user) {
            res.writeHead(303, { Location: '/register' });
            res.end();
            return;
        }

        if (user.passwordHash !== this.createPasswordHash(password, user.salt)) {
            res.writeHead(403);
            res.end(this.formRenderer.renderForm('login', 'Неверный пароль'));
            return;
        }

        const sid = this.sessions.createSession(email);
        res.writeHead(303, {
            'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`,
            Location: '/dice'
        });
        res.end();
    };

    public handleLogout: RouteHandler = (req, res) => {
        const sid = this.sessions.getSidFromCookie(req.headers.cookie);
        if (sid) this.sessions.destroySession(sid);
        res.writeHead(303, {
            'Set-Cookie': `sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
            Location: '/login'
        });
        res.end();
    };

    public handleDice: RouteHandler = (req, res) => {

        const baseDir = "/opt/dice";

        let url = (req.url || "").split("?")[0];

        // убираем /dice если есть
        url = url.replace(/^\/dice/, "");

        if (url === "" || url === "/") {
            url = "/index.html";
        }

        const filePath = path.join(baseDir, url);

        console.log("URL:", req.url);
        console.log("PATH:", filePath);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {

            const ext = path.extname(filePath).toLowerCase();

            const mime: Record<string,string> = {
                ".js":"text/javascript",
                ".css":"text/css",
                ".html":"text/html",
                ".svg":"image/svg+xml",
                ".json":"application/json",
                ".png":"image/png",
                ".jpg":"image/jpeg",
                ".jpeg":"image/jpeg",
                ".ico":"image/x-icon"
            };

            res.writeHead(200, {
                "Content-Type": mime[ext] || "application/octet-stream"
            });

            fs.createReadStream(filePath).pipe(res);
            return;
        }

        res.writeHead(404);
        res.end("File not found");
    };
}