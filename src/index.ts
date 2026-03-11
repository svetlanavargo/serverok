import path from 'node:path';
import Database from 'better-sqlite3';
import UserRepository from './db/userRepository';
import WebServer from './application/WebServer';
import AuthController from './application/AuthController';
import { FormRenderer } from './application/FormRenderer';
import SessionManager from './application/SessionManager';
import EnvManager from './application/EnvManager';

const env = new EnvManager('.env');
const { FIRST_FLAG, SECOND_FLAG } = env.getFlags();

const database = new Database(path.join(process.cwd(), 'data', 'database.sqlite'));
const users = new UserRepository(database);

const sessions = new SessionManager();
const formRenderer = new FormRenderer();
const authController = new AuthController(users, sessions, formRenderer);

const server = new WebServer(3000);

server.registerRoute('GET', '/', authController.authRequired(authController.handleDice));
server.registerRoute('GET', '/dice', authController.authRequired(authController.handleDice));
server.registerRoute('GET', '/register', authController.showRegisterForm);
server.registerRoute('POST', '/register', authController.handleRegister);
server.registerRoute('GET', '/login', authController.showLoginForm);
server.registerRoute('POST', '/login', authController.handleLogin);
server.registerRoute('POST', '/logout', authController.handleLogout);

server.start();

console.log('Current users in DB:', users.getAllUsers());

export default database;