"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const userRepository_1 = __importDefault(require("./db/userRepository"));
const gameRepository_1 = __importDefault(require("./db/gameRepository"));
const characterRepository_1 = __importDefault(require("./db/characterRepository"));
const WebServer_1 = __importDefault(require("./application/WebServer"));
const AuthController_1 = __importDefault(require("./application/AuthController"));
const SessionManager_1 = __importDefault(require("./application/SessionManager"));
const config_1 = require("./config");
const database = new better_sqlite3_1.default(config_1.DATABASE_PATH);
const users = new userRepository_1.default(database);
const games = new gameRepository_1.default(database);
const characters = new characterRepository_1.default(database);
const sessions = new SessionManager_1.default(database);
const authController = new AuthController_1.default(users, games, characters, sessions);
const server = new WebServer_1.default(config_1.SERVER_PORT);
const routes = [
    ['GET', '/', authController.handleRoot],
    ['POST', '/api/register', authController.handleRegister],
    ['POST', '/api/login', authController.handleLogin],
    ['POST', '/api/logout', authController.handleLogout],
    ['GET', '/api/me', authController.handleMe],
    ['POST', '/api/games', authController.handleCreateGame],
    ['GET', '/api/games', authController.handleGetGames],
    ['POST', '/api/games/update', authController.handleUpdateGame],
    ['POST', '/api/games/delete', authController.handleDeleteGame],
    ['POST', '/api/characters', authController.handleCreateCharacter],
    ['GET', '/api/characters', authController.handleGetCharacters],
    ['POST', '/api/characters/update', authController.handleUpdateCharacter],
    ['POST', '/api/characters/delete', authController.handleDeleteCharacter]
];
routes.forEach(([method, path, handler]) => {
    server.registerRoute(method, path, handler);
});
server.start();
exports.default = database;
