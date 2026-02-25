import * as http from 'node:http';
import fs from 'node:fs';

const PORT = 3000;

const data = fs.readFileSync('register.html', 'utf-8');

const server = http.createServer((req, res) => {
    res.statusCode = 200
    if (req.method === 'GET' && req.url === '/') {
        res.statusCode = 200
        res.end(data)
    }
    else {
        req.statusCode = 404
        res.end('sosi pisos')
    }
});

server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}/`);
});
