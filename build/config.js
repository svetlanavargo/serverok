"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_MAX_AGE_SECONDS = exports.SESSION_TTL_MS = exports.DATABASE_PATH = exports.CORS_ORIGIN = exports.SERVER_PORT = void 0;
const node_path_1 = __importDefault(require("node:path"));
const currentDirPath = __dirname;
const projectRoot = node_path_1.default.resolve(currentDirPath, '..');
exports.SERVER_PORT = Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3001);
exports.CORS_ORIGIN = (_b = process.env.CORS_ORIGIN) !== null && _b !== void 0 ? _b : 'https://dndapp.ru';
exports.DATABASE_PATH = node_path_1.default.join(projectRoot, 'data', 'database.sqlite');
exports.SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
exports.SESSION_MAX_AGE_SECONDS = Math.floor(exports.SESSION_TTL_MS / 1000);
