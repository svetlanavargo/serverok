import * as http from 'node:http';
import { CORS_ORIGIN } from '../config';

export type RouteHandler = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body?: string
) => void;

export default class WebServer {
    private routes: Record<string, RouteHandler> = {};

    constructor(private port: number) {}

    private getRouteKey(method: string, path: string) {
        return `${method.toUpperCase()} ${path}`;
    }

    private setCors(res: http.ServerResponse) {
        res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }

    private handleOptions(req: http.IncomingMessage, res: http.ServerResponse) {
        if (req.method === 'OPTIONS') {
            this.setCors(res);
            res.writeHead(204);
            res.end();
            return true;
        }
        return false;
    }

    public registerRoute(
        method: 'GET' | 'POST',
        path: string,
        handler: RouteHandler
    ) {
        this.routes[this.getRouteKey(method, path)] = handler;
    }

    private readRequestBody(req: http.IncomingMessage) {
        return new Promise<string>((resolve, reject) => {
            let data = '';

            req.on('data', chunk => (data += chunk));
            req.on('end', () => resolve(data));
            req.on('error', err => reject(err));
        });
    }

    private async getRequestBody(req: http.IncomingMessage) {
        if (req.method !== 'POST') {
            return undefined;
        }

        return this.readRequestBody(req);
    }

    private logRequest(method: string | undefined, url: string) {
        console.log(`[${new Date().toISOString()}] ${method} ${url}`);
    }

    private handleMissingRoute(res: http.ServerResponse) {
        res.writeHead(404);
        res.end('Not found');
    }

    public start() {
        const server = http.createServer(async (req, res) => {
            const url = req.url?.split('?')[0] || '';

            this.logRequest(req.method, url);

            this.setCors(res);

            if (this.handleOptions(req, res)) {
                return;
            }

            const body = await this.getRequestBody(req);
            const handler = this.routes[this.getRouteKey(req.method ?? '', url)];

            if (!handler) {
                this.handleMissingRoute(res);
                return;
            }

            try {
                handler(req, res, body);
            } catch (err) {
                console.error(err);
                res.writeHead(500);
                res.end('Internal server error');
            }
        });

        server.listen(this.port, () =>
            console.log(`Server running at http://localhost:${this.port}/`)
        );
    }
}
