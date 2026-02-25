import * as http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const PORT = 3000;
const BD = JSON.parse(fs.readFileSync('bd.json', 'utf-8'))
const USERS_ARR = BD.users
const FORM = fs.readFileSync('register.html', 'utf-8');

const getPostedData = async (req) => {
    return new Promise((resolve, reject) => {
        let body = ''

        req.on('data', chunk => body += chunk)

        req.on('end', () => {
            const data = new URLSearchParams(body)
            resolve ([data.get('email'), data.get('password')])
        })
        req.on('error', err => reject(err))
    })
}

const registerUser = (email, password) => {
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = crypto.createHash('sha256')
        .update(password + salt).digest('hex')

    const user = {
        id: crypto.randomUUID(),
        email: email,
        passwordHash: passwordHash,
        salt: salt
    }

    USERS_ARR.push(user)
    fs.writeFileSync('bd.json', JSON.stringify(BD, null, 2), 'utf-8')
}

const loginUser = (email, password) => {

}

const showRegisterForm = (req, res) => {
    res.statusCode = 200
    res.end(FORM)
}
const showLoginForm = (req, res) => {
    res.statusCode = 200
    res.end(FORM)
}

const handleRegister = async (req, res) => {
    const [userEmail, userPassword] = await getPostedData(req)

    if (!USERS_ARR.some(user => user.email === userEmail)) {
        registerUser(userEmail, userPassword)
        res.end('ZAEBOCHEK! You are is registered, bro!')
    } else {
        res.end('This email is already registered')
    }
    console.log(userEmail, userPassword)
}

const handleLogin = async (req, res) => {
    const [userEmail, userPassword] = await getPostedData(req)

}

const ROUTES = {
    "GET /register": showRegisterForm,
    "GET /login": showLoginForm,
    "POST /register": handleRegister,
    "POST /login": handleLogin
}

const server = http.createServer(async (req, res) => {
    const key = `${req.method} ${req.url}`

    ROUTES[key]?.(req, res) || (() => {
        req.statusCode = 404
        res.end('sosi pisos')
    })()
});

server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}/`);
});
