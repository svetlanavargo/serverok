import * as http from 'node:http';

export type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse, body?: string) => void;

export default class WebServer {
    private routes: Record<string, RouteHandler> = {};

    constructor(private port: number) {}

    public registerRoute(method: 'GET' | 'POST', path: string, handler: RouteHandler) {
        this.routes[`${method.toUpperCase()} ${path}`] = handler;
    }

    public start() {
        const server = http.createServer(async (req, res) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} UA="${req.headers['user-agent']}"`);

            let body: string | undefined;
            if (req.method === 'POST') {
                body = await new Promise<string>((resolve, reject) => {
                    let data = '';
                    req.on('data', chunk => data += chunk);
                    req.on('end', () => resolve(data));
                    req.on('error', err => reject(err));
                });
            }

            const key = `${req.method} ${req.url}`;
            const handler = this.routes[key];

            if (handler) {
                handler(req, res, body);
            } else {
                res.statusCode = 404;
                res.end('Not found');
            }
        });

        server.listen(this.port, () => console.log(`Server running at http://localhost:${this.port}/`));
    }
}