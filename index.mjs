import * as http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const PORT = 3000;
const SESSIONS = {};
const FORM_CONTEXT = {
    register: {
        TITLE: 'Регистрация',
        ACTION: '/register',
        BUTTON_TEXT: 'Зарегистрироваться'
    },
    login: {
        TITLE: 'Авторизация',
        ACTION: '/login',
        BUTTON_TEXT: 'Войти'
    }
};

const renderForm = (formContextKey, error = '') => {
    const context = FORM_CONTEXT[formContextKey]
    let FORM = fs.readFileSync('index.html', 'utf-8');

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
const validateData = (email, password) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

    if (!emailRegex.test(email)) {
        return {
            valid: false,
            error: "Неверный email"
        }
    }
    if (password.length < 8) {
        return {
            valid: false,
            error: "Пароль должен быть не менее 8 символов"
        }
    }

    return {
        valid: true
    }
}
const getValidData = async (req, res, form) => {
    const [email, password] = await getPostedData(req)
    const {valid, error} = validateData(email, password)

    if (!valid) {
        res.statusCode = 400
        res.end(renderForm(form, error))
        return null
    }

    return [email, password]
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
const toLogin = (res) => {
    res.statusCode = 302
    res.setHeader("Location", "/login")
    return res.end()
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
    fs.writeFileSync('bd.json', JSON.stringify(DB, null, 2), 'utf-8')
}
const checkPassword = (password, baseHashedPassword, salt) => {
    const passwordHash = createPasswordHash(password, salt)

    if (baseHashedPassword !== passwordHash) {
        return {
            isCorrect: false,
            error: 'Неверный пароль'
        }
    }

    return {isCorrect: true}
}
const isLoggedIn = (req, res) => {
    const cookie = req.headers.cookie

    if(!cookie) {
        return toLogin(res)
    }

    const userSid = getSid(cookie)

    if (!SESSIONS[userSid]) {
        return toLogin(res)
    }

    const date = Date.now()
    if (date > SESSIONS[userSid].expiresAt) {
        return toLogin(res)
    }

    return true

}
const createSession = (email) => {
    const sid = crypto.randomBytes(24).toString("hex")
    const expiresAt = Date.now() + 1000 * 60 * 60

    SESSIONS[sid] = {email, expiresAt}

    return sid
}
const authRequired = (handler) => {
    return (req, res) => {
        if (isLoggedIn(req, res)) {
            handler(req, res)
        }
    }
}

const handleRegister = async (req, res) => {
    const data = await getValidData(req, res, 'register')
    if (!data) return
    const [email, password] = data

    const DB = JSON.parse(fs.readFileSync('bd.json', 'utf-8'))

    if (DB.users.some(user => user.email === email)) {
        res.statusCode = 409
        return res.end(renderForm('register', 'Такой email уже зарегистрирован'))
    }

    registerUser(email, password, DB)
    console.log('Пользователь зарегистрирован')
    res.statusCode = 302
    res.setHeader('Location', '/login')
    res.end()
}
const handleLogin = async (req, res) => {
    const data = await getValidData(req, res, 'login')
    if (!data) return
    const [email, password] = data

    const DB = JSON.parse(fs.readFileSync('bd.json', 'utf-8'))
    const user = DB.users.find(user => user.email === email)

    if (!user) {
        res.statusCode = 303
        res.setHeader('Location', '/register')
        return res.end()
    }

    const {isCorrect, error} = checkPassword(password, user.passwordHash, user.salt)

    if (!isCorrect) {
        res.statusCode = 401
        return res.end(renderForm('login', error))
    }

    const sid = createSession(email)
    res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`)

    res.statusCode = 303
    res.setHeader('Location', '/data-first')
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

const pageFirst = (req, res) => {
    res.statusCode = 200
    res.end('first')
}
const pageSecond = (req, res) => {
    res.statusCode = 200
    res.end('second')
}

const ROUTES = {
    "GET /register": showRegisterForm,
    "GET /login": showLoginForm,
    "GET /data-first": authRequired(pageFirst),
    "GET /data-second": authRequired(pageSecond),
    "POST /register": handleRegister,
    "POST /login": handleLogin
}

const server = http.createServer(async (req, res) => {
    const key = `${req.method} ${req.url}`

    if (ROUTES[key]) {
        ROUTES[key](req, res)
    } else {
        res.statusCode = 404
        res.end('Not found')
    }
});

server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}/`);
});
