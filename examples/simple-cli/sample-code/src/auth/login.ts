// Authentication module
// Handles user login and token generation

import { database } from '../database/connection';
import { verifyPassword, generateToken } from './utils';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
}

export interface Credentials {
  username: string;
  password: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Authenticate a user with username and password
 * @param credentials - User credentials
 * @returns JWT token if authentication succeeds
 * @throws AuthError if authentication fails
 */
export async function login(credentials: Credentials): Promise<string> {
  const user = await database.users.findOne({
    username: credentials.username
  });

  if (!user) {
    throw new AuthError('Invalid credentials');
  }

  const isValid = await verifyPassword(
    credentials.password,
    user.passwordHash
  );

  if (!isValid) {
    throw new AuthError('Invalid password');
  }

  return generateToken(user);
}

/**
 * Verify a JWT token and return the user
 * @param token - JWT token
 * @returns User object
 * @throws AuthError if token is invalid
 */
export async function verifyToken(token: string): Promise<User> {
  const decoded = await decodeToken(token);

  if (!decoded || !decoded.userId) {
    throw new AuthError('Invalid token');
  }

  const user = await database.users.findById(decoded.userId);

  if (!user) {
    throw new AuthError('User not found');
  }

  return user;
}

/**
 * Middleware to protect routes
 * Verifies JWT token from Authorization header
 */
export function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}
