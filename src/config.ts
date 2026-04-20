import path from 'node:path';

const currentDirPath = __dirname;
const projectRoot = path.resolve(currentDirPath, '..');

export const SERVER_PORT = Number(process.env.PORT ?? 3001);
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'https://dndapp.ru';
export const DATABASE_PATH = path.join(projectRoot, 'data', 'database.sqlite');
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
