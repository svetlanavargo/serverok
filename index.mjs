import * as http from 'node:http';
import fs from 'node:fs';

const PORT = 3000;

const data = fs.readFileSync('index.html', 'utf-8');

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/give-me-something-great') {
        res.statusCode = 200
        res.end(data)
    }
    else {
        res.statusCode = 200
        res.end('sosi pisos')
    }
});

server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}/`);
});
