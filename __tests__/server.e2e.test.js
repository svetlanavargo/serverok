const axios = require('axios');
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ */
/*  Конфигурация                                                       */
/* ------------------------------------------------------------------ */
const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(__dirname, '..');

const TEST_USER = { email: 'test@example.com', password: 'password123' };

// Не следовать редиректам, не бросать ошибку на 4xx/5xx
const api = axios.create({
  baseURL: BASE,
  maxRedirects: 0,
  validateStatus: () => true,
});

/* ------------------------------------------------------------------ */
/*  Хелперы                                                            */
/* ------------------------------------------------------------------ */

/** Поиск файла БД (db.json или database.json) */
function findDbFile() {
  for (const name of ['database.json']) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readDb() {
  const p = findDbFile();
  if (!p) return { users: [] };
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

/** Парсинг Set-Cookie заголовков */
function parseSetCookies(res) {
  const raw = res.headers['set-cookie'];
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((str) => {
    const parts = str.split(';').map((s) => s.trim());
    const [nameVal, ...attrs] = parts;
    const eq = nameVal.indexOf('=');
    return {
      name: nameVal.slice(0, eq),
      value: nameVal.slice(eq + 1),
      attrs: attrs.map((a) => a.toLowerCase()),
      raw: str,
    };
  });
}

function findSidCookie(res) {
  return parseSetCookies(res).find((c) => c.name === 'sid');
}

/* ------------------------------------------------------------------ */
/*  Подготовка: чистая БД перед тестами                                */
/* ------------------------------------------------------------------ */

beforeAll(() => {
  const emptyDb = JSON.stringify({ users: [] }, null, 2);
  for (const name of ['db.json', 'database.json']) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) {
      fs.writeFileSync(p, emptyDb, 'utf-8');
    }
  }
});

/* ================================================================== */
/*  ТЕСТЫ                                                              */
/* ================================================================== */

/* ---------- GET /health ------------------------------------------- */
describe('GET /health', () => {
  test('сервер жив — статус 200 и тело "alive"', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.data).toContain('alive');
  });
});

/* ---------- GET / ------------------------------------------------- */
describe('GET /', () => {
  test('возвращает статус 200', async () => {
    const res = await api.get('/');
    expect(res.status).toBe(200);
  });

  test('без авторизации на странице есть формы/ссылки регистрации и логина', async () => {
    const res = await api.get('/');
    const body = res.data.toLowerCase();
    expect(body).toMatch(/register|регистр|signup/);
    expect(body).toMatch(/login|вход|войти|авториз/);
  });

  test('на главной странице НЕ отображаются секретные флаги', async () => {
    const res = await api.get('/');
    expect(res.data).not.toMatch(/FLAG\{/);
  });
});

/* ---------- POST /register ---------------------------------------- */
describe('POST /register', () => {
  test('регистрация нового пользователя — статус 200-302', async () => {
    const res = await api.post('/register', new URLSearchParams(TEST_USER).toString());
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(400);
  });

  test('пользователь сохранён в БД с полями id, email, passwordHash', () => {
    const db = readDb();
    const user = db.users.find((u) => u.email === TEST_USER.email);
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBe(TEST_USER.email);
    expect(user.passwordHash).toBeDefined();
  });

  test('пароль хранится как sha256-хеш (64 hex-символа), а НЕ открытым текстом', () => {
    const db = readDb();
    const user = db.users.find((u) => u.email === TEST_USER.email);
    expect(user.passwordHash).not.toBe(TEST_USER.password);
    // sha256 = 64 hex-символа
    expect(user.passwordHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('повторная регистрация с тем же email — ошибка 400 или 409', async () => {
    const res = await api.post('/register', new URLSearchParams(TEST_USER).toString());
    expect([400, 409]).toContain(res.status);
  });

  test('валидация email — должен содержать "@"', async () => {
    const res = await api.post(
      '/register',
      new URLSearchParams({ email: 'invalidemail', password: 'password123' }).toString(),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('валидация email — после "@" должна быть точка', async () => {
    const res = await api.post(
      '/register',
      new URLSearchParams({ email: 'user@nodot', password: 'password123' }).toString(),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('валидация пароля — минимум 8 символов', async () => {
    const res = await api.post(
      '/register',
      new URLSearchParams({ email: 'short@pass.com', password: '1234567' }).toString(),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

/* ---------- POST /login ------------------------------------------- */
describe('POST /login', () => {
  test('логин с верными данными — статус 200-302 и cookie sid', async () => {
    const res = await api.post('/login', new URLSearchParams(TEST_USER).toString());
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(400);

    const sid = findSidCookie(res);
    expect(sid).toBeDefined();
    expect(sid.value.length).toBeGreaterThan(0);
  });

  test('sid криптографически случайный (>= 48 hex-символов = 24 байта)', async () => {
    const res = await api.post('/login', new URLSearchParams(TEST_USER).toString());
    const sid = findSidCookie(res);
    expect(sid).toBeDefined();
    // 24 случайных байта → 48 hex-символов
    expect(sid.value.length).toBeGreaterThanOrEqual(48);
    expect(sid.value).toMatch(/^[a-f0-9]+$/);
  });

  test('cookie sid содержит атрибут HttpOnly', async () => {
    const res = await api.post('/login', new URLSearchParams(TEST_USER).toString());
    const sid = findSidCookie(res);
    expect(sid).toBeDefined();
    expect(sid.attrs.some((a) => a === 'httponly')).toBe(true);
  });

  test('cookie sid содержит SameSite=Lax', async () => {
    const res = await api.post('/login', new URLSearchParams(TEST_USER).toString());
    const sid = findSidCookie(res);
    expect(sid).toBeDefined();
    expect(sid.attrs.some((a) => a.includes('samesite=lax'))).toBe(true);
  });

  test('cookie sid содержит Path=/', async () => {
    const res = await api.post('/login', new URLSearchParams(TEST_USER).toString());
    const sid = findSidCookie(res);
    expect(sid).toBeDefined();
    expect(sid.attrs.some((a) => a === 'path=/')).toBe(true);
  });

  test('cookie sid содержит Max-Age', async () => {
    const res = await api.post('/login', new URLSearchParams(TEST_USER).toString());
    const sid = findSidCookie(res);
    expect(sid).toBeDefined();
    expect(sid.raw.toLowerCase()).toMatch(/max-age=\d+/);
  });

  test('неверный пароль — статус 400/401/403', async () => {
    const res = await api.post(
      '/login',
      new URLSearchParams({ email: TEST_USER.email, password: 'wrongpassword' }).toString(),
    );
    expect([400, 401, 403]).toContain(res.status);
  });

  test('несуществующий пользователь — статус 400/401/403', async () => {
    const res = await api.post(
      '/login',
      new URLSearchParams({ email: 'nobody@example.com', password: 'password123' }).toString(),
    );
    expect([400, 401, 403]).toContain(res.status);
  });
});

/* ---------- Защищённые роуты -------------------------------------- */
describe('Защищённые роуты', () => {
  let validSid;

  beforeAll(async () => {
    const res = await api.post('/login', new URLSearchParams(TEST_USER).toString());
    const sid = findSidCookie(res);
    validSid = sid ? sid.value : null;
  });

  /* --- без cookie --- */
  test('GET /data-first без авторизации — редирект (3xx) или 401', async () => {
    const res = await api.get('/data-first');
    const blocked =
      res.status === 401 ||
      res.status === 403 ||
      (res.status >= 300 && res.status < 400);
    expect(blocked).toBe(true);
  });

  test('GET /data-second без авторизации — редирект (3xx) или 401', async () => {
    const res = await api.get('/data-second');
    const blocked =
      res.status === 401 ||
      res.status === 403 ||
      (res.status >= 300 && res.status < 400);
    expect(blocked).toBe(true);
  });

  /* --- с невалидным sid --- */
  test('GET /data-first с невалидным sid — редирект или 401', async () => {
    const res = await api.get('/data-first', {
      headers: { Cookie: 'sid=invalid_session_id_value' },
    });
    const blocked =
      res.status === 401 ||
      res.status === 403 ||
      (res.status >= 300 && res.status < 400);
    expect(blocked).toBe(true);
  });

  test('GET /data-second с невалидным sid — редирект или 401', async () => {
    const res = await api.get('/data-second', {
      headers: { Cookie: 'sid=invalid_session_id_value' },
    });
    const blocked =
      res.status === 401 ||
      res.status === 403 ||
      (res.status >= 300 && res.status < 400);
    expect(blocked).toBe(true);
  });

  /* --- с валидным sid --- */
  test('GET /data-first с валидным sid — статус 200 и контент', async () => {
    expect(validSid).toBeTruthy();
    const res = await api.get('/data-first', {
      headers: { Cookie: `sid=${validSid}` },
    });
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(0);
  });

  test('GET /data-second с валидным sid — статус 200 и контент', async () => {
    expect(validSid).toBeTruthy();
    const res = await api.get('/data-second', {
      headers: { Cookie: `sid=${validSid}` },
    });
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(0);
  });
});

/* ---------- POST /logout ------------------------------------------ */
describe('POST /logout', () => {
  let sidForLogout;

  beforeAll(async () => {
    const res = await api.post('/login', new URLSearchParams(TEST_USER).toString());
    const sid = findSidCookie(res);
    sidForLogout = sid ? sid.value : null;
  });

  test('возвращает успешный ответ или редирект', async () => {
    expect(sidForLogout).toBeTruthy();
    const res = await api.post('/logout', null, {
      headers: { Cookie: `sid=${sidForLogout}` },
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(400);
  });

  test('очищает cookie sid (Max-Age=0 или пустое значение)', async () => {
    // Логинимся заново для свежего sid
    const loginRes = await api.post('/login', new URLSearchParams(TEST_USER).toString());
    const loginSid = findSidCookie(loginRes);
    expect(loginSid).toBeDefined();

    const res = await api.post('/logout', null, {
      headers: { Cookie: `sid=${loginSid.value}` },
    });

    const sidCookie = findSidCookie(res);
    if (sidCookie) {
      const cleared =
        sidCookie.raw.toLowerCase().includes('max-age=0') ||
        sidCookie.value === '';
      expect(cleared).toBe(true);
    }
    // Если Set-Cookie нет — допустимо (сессия удалена на сервере)
  });

  test('после логаута защищённые роуты недоступны с этим sid', async () => {
    const res = await api.get('/data-first', {
      headers: { Cookie: `sid=${sidForLogout}` },
    });
    const blocked =
      res.status === 401 ||
      res.status === 403 ||
      (res.status >= 300 && res.status < 400);
    expect(blocked).toBe(true);
  });
});

/* ---------- 404 --------------------------------------------------- */
describe('404 на неизвестные роуты', () => {
  test('GET /nonexistent → 404', async () => {
    const res = await api.get('/nonexistent');
    expect(res.status).toBe(404);
  });

  test('POST /nonexistent → 404', async () => {
    const res = await api.post('/nonexistent');
    expect(res.status).toBe(404);
  });

  test('GET /data-third (несуществующий роут) → 404', async () => {
    const res = await api.get('/data-third');
    expect(res.status).toBe(404);
  });
});

/* ---------- Безопасность ------------------------------------------ */
describe('Безопасность', () => {
  test('на GET / нет секретных FLAG{...}', async () => {
    const res = await api.get('/');
    expect(res.data).not.toMatch(/FLAG\{/);
  });
});
