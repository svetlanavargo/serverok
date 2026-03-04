import * as http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const PORT = 3000;
const SESSIONS = {};
const FORM_CONTEXT = {
    register: {
        TITLE: 'Регистрация',
        ACTION: '/register',
        BUTTON_TEXT: 'Зарегистрироваться',
        REDIRECT_LINK: '/login',
        REDIRECT_TEXT: 'Уже зарегистрированы?'
    },
    login: {
        TITLE: 'Авторизация',
        ACTION: '/login',
        BUTTON_TEXT: 'Войти',
        REDIRECT_LINK: '/register',
        REDIRECT_TEXT: 'Регистрация'
    }
};
const ENV_FILE = fs.readFileSync('.env', 'utf-8')

const envObject = Object.fromEntries(
    ENV_FILE.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
            const [key, value] = line.split('=')
            return [key, value]
        })
)

const { FIRST_FLAG: firstFlag, SECOND_FLAG: secondFlag } = envObject

const renderForm = (formContextKey, error = '') => {
    const context = FORM_CONTEXT[formContextKey]
    let FORM = fs.readFileSync('form.html', 'utf-8');

    for (const key in context) {
        const regEx = new RegExp(`{{${key.toUpperCase()}}}`, 'g')
        FORM = FORM.replace(regEx, context[key])
    }

    FORM = FORM.replace(/{{ERROR}}/g, error)

    return FORM
}

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
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

    if (!emailRegex.test(email)) {
        return {
            valid: false,
            error: "Неверный формат email"
        }
    }

    return {
        valid: true
    }
}

const createPasswordHash = (password, salt) => {
    return crypto.createHash('sha256')
        .update(password + salt).digest('hex')
}
const getSid = (cookie) => {
    const cookiesArr = cookie.split(';')
    const cookiesObj = {}

    for (const cookie of cookiesArr) {
        const [key, value] = cookie.trim().split('=')
        cookiesObj[key] = value
    }

    return cookiesObj.sid
}

const registerUser = (email, password, DB) => {
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = createPasswordHash(password, salt)

    const user = {
        id: crypto.randomUUID(),
        email: email,
        passwordHash: passwordHash,
        salt: salt
    }

    DB.users.push(user)
    fs.writeFileSync('database.json', JSON.stringify(DB, null, 2), 'utf-8')
}
const checkPassword = (password, baseHashedPassword, salt) => {
    const passwordHash = createPasswordHash(password, salt)
    return baseHashedPassword === passwordHash
}
const createSession = (email) => {
    const sid = crypto.randomBytes(24).toString("hex")
    const expiresAt = Date.now() + 1000 * 60 * 60

    SESSIONS[sid] = {email, expiresAt}

    return sid
}
const authRequired = (handler) => {
    return (req, res) => {
        const cookie = req.headers.cookie

        if(!cookie) {
            res.statusCode = 302
            res.setHeader("Location", "/login")
            res.end()
            return
        }

        const userSid = getSid(cookie)

        if (!SESSIONS[userSid]) {
            res.statusCode = 302
            res.setHeader("Location", "/login")
            res.end()
            return
        }

        const date = Date.now()

        if (date > SESSIONS[userSid].expiresAt) {
            res.statusCode = 302
            res.setHeader("Location", "/login")
            res.end()
            return
        }

        handler(req, res)
    }
}

const handleRegister = async (req, res) => {
    const [email, password] = await getPostedData(req)
    const {valid, error} = validateEmail(email)

    if (!valid) {
        res.statusCode = 400
        res.end(renderForm('register', error))
        return
    }

    if (password.length < 8) {
        res.statusCode = 400
        res.end(renderForm('register', 'Пароль должен быть не менее 8 символов'))
        return
    }

    if (!fs.existsSync('database.json')) {
        const base = {
            users: []
        }

        fs.writeFileSync(
            'database.json',
            JSON.stringify(base, null, 2),
            'utf-8'
        )
    }

    const DB = JSON.parse(fs.readFileSync('database.json', 'utf-8'))

    if (DB.users.some(user => user.email === email)) {
        res.statusCode = 409
        res.end(renderForm('register', 'Такой email уже зарегистрирован'))
        return
    }

    registerUser(email, password, DB)
    res.statusCode = 302
    res.setHeader('Location', '/login')
    res.end()
}
const handleLogin = async (req, res) => {
    const [email, password] = await getPostedData(req)
    const {valid, error} = validateEmail(email)

    if (!valid) {
        res.statusCode = 403
        res.end(renderForm('login', error))
        return
    }

    if (!fs.existsSync('database.json')) {
        const base = {
            users: []
        }

        fs.writeFileSync(
            'database.json',
            JSON.stringify(base, null, 2),
            'utf-8'
            )
    }

    const DB = JSON.parse(fs.readFileSync('database.json', 'utf-8'))
    const user = DB.users.find(user => user.email === email)

    if (!user) {
        res.statusCode = 303
        res.setHeader('Location', '/register')
        res.end()
        return
    }

    const isCorrect = checkPassword(password, user.passwordHash, user.salt)

    if (!isCorrect) {
        res.statusCode = 403
        res.end(renderForm('login', 'Неверный пароль'))
        return
    }

    const sid = createSession(email)
    res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`)

    res.statusCode = 303
    res.setHeader('Location', '/')
    res.end()
}
const handleLogout = async (req, res) => {
    const cookie = req.headers.cookie
    if (cookie) {
        const userSid = getSid(cookie)
        delete SESSIONS[userSid]
    }

    res.setHeader('Set-Cookie', `sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
    res.statusCode = 302
    res.setHeader("Location", "/login")
    res.end()
}

const showRegisterForm = (req, res) => {
    res.statusCode = 200
    res.end(renderForm('register', ''))
}
const showLoginForm = (req, res) => {
    res.statusCode = 200
    res.end(renderForm('login', ''))
}
const handleDice = (req, res) => {
    const baseDir = '/opt/dice';
    let relativePath = req.url.slice('/dice'.length)

    if (!relativePath || relativePath === '/') {
        relativePath = '/index.html';
    }

    const fullPath = path.join(baseDir, relativePath);
    const resolvedPath = path.resolve(fullPath);

    if (!resolvedPath.startsWith(baseDir)) {
        res.statusCode = 403
        res.end('Forbidden')
    }

    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const ext = path.extname(resolvedPath).toLowerCase()
        let contentType = 'text/plain'
        if(ext==='.js') contentType='text/javascript'
        else if(ext==='.css') contentType='text/css'
        else if(ext==='.html') contentType='text/html'
        else if(ext==='.svg') contentType='image/svg+xml'
        else if(ext==='.json') contentType='application/json'
        else if(ext==='.ico') contentType='image/x-icon'

        res.setHeader('Content-Type',contentType)
        res.statusCode = 200
        res.end(fs.readFileSync(resolvedPath))
    }

    const indexPath = path.join(baseDir,'index.html')
    if(fs.existsSync(indexPath)){
        res.setHeader('Content-Type','text/html')
        res.statusCode = 200
        res.end(fs.readFileSync(indexPath))
    } else {
        res.statusCode = 500
        res.end('index.html not found')
    }
}

const ROUTES = {
    "GET /": authRequired(handleDice),
    "GET /register": showRegisterForm,
    "GET /login": showLoginForm,
    "GET /dice": authRequired(handleDice),
    "POST /register": handleRegister,
    "POST /login": handleLogin,
    "POST /logout": handleLogout,
}

const server = http.createServer(async (req, res) => {
    const time = Date.now()
    const method = req.method
    const url = req.url
    const ua = req.headers['user-agent'] || ''

    console.log(`[${time}] ${method} ${url} UA="${ua}"`)

    const key = `${method} ${url}`

    if (ROUTES[key]) {
        ROUTES[key](req,res)
    }
    else if (req.url.startsWith('/dice')) {
        authRequired(handleDice)(req,res)
    }
    else {
        res.statusCode = 404
        res.end('Not found')
    }
});

server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}/`);
});
