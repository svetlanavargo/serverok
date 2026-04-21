import * as http from 'node:http';
import { CORS_ORIGIN } from '../config';

type SupportedRouteMethod = 'GET' | 'POST';

export type RouteHandler = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body?: string
) => void;

export default class WebServer {
    private routes: Record<string, Partial<Record<SupportedRouteMethod, RouteHandler>>> = {};

    constructor(private port: number) {}

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
        method: SupportedRouteMethod,
        path: string,
        handler: RouteHandler
    ) {
        this.routes[path] ??= {};
        this.routes[path][method] = handler;
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

    private getRouteHandler(method: string | undefined, path: string) {
        if (!method) {
            return undefined;
        }

        const methodRoutes = this.routes[path];
        if (!methodRoutes) {
            return undefined;
        }

        return methodRoutes[method.toUpperCase() as SupportedRouteMethod];
    }

    private getAllowedMethods(path: string): SupportedRouteMethod[] {
        const methodRoutes = this.routes[path];
        if (!methodRoutes) {
            return [];
        }

        return Object.keys(methodRoutes) as SupportedRouteMethod[];
    }

    private handleMethodNotAllowed(res: http.ServerResponse, path: string) {
        const allowedMethods = this.getAllowedMethods(path);

        res.writeHead(405, {
            Allow: [...allowedMethods, 'OPTIONS'].join(',')
        });
        res.end('Method not allowed');
    }

    public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = req.url?.split('?')[0] || '';

        this.logRequest(req.method, url);

        this.setCors(res);

        if (this.handleOptions(req, res)) {
            return;
        }

        const handler = this.getRouteHandler(req.method, url);

        if (!handler) {
            if (this.getAllowedMethods(url).length > 0) {
                this.handleMethodNotAllowed(res, url);
                return;
            }

            this.handleMissingRoute(res);
            return;
        }

        const body = await this.getRequestBody(req);
        handler(req, res, body);
    }

    public start() {
        const server = http.createServer(async (req, res) => {
            try {
                await this.handleRequest(req, res);
            } catch (err) {
                console.error(err);
                res.writeHead(500);
                res.end('Internal server error');
            }
        });

        server.listen(this.port, () =>
            console.log(`Server running at http://localhost:${this.port}/`)
        );

        return server;
    }
}
