import Database from 'better-sqlite3';

import UserRepository from './db/userRepository';
import GameRepository from './db/gameRepository';
import CharacterRepository from './db/characterRepository';
import WebServer from './application/WebServer';
import AuthController from './application/AuthController';
import SessionManager from './application/SessionManager';
import { RouteHandler } from './application/WebServer';
import { DATABASE_PATH, SERVER_PORT } from './config';

const database = new Database(DATABASE_PATH);

const users = new UserRepository(database);
const games = new GameRepository(database);
const characters = new CharacterRepository(database);

const sessions = new SessionManager(database);
const authController = new AuthController(users, games, characters, sessions);
const server = new WebServer(SERVER_PORT);

const routes: Array<['GET' | 'POST', string, RouteHandler]> = [
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

export default database;
