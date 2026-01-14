// API routes module
// Defines HTTP endpoints for the application

import { Router } from 'express';
import { login, authMiddleware } from '../auth/login';
import { collections } from '../database/connection';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required'
      });
    }

    const token = await login({ username, password });
    res.json({ token });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email, and password are required'
      });
    }

    // Check if user already exists
    const existing = await collections.users.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password (simplified)
    const passwordHash = await hashPassword(password);

    const user = await collections.users.create({
      username,
      email,
      passwordHash
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/me
 * Get current user profile (protected route)
 */
router.get('/api/users/me', authMiddleware, async (req, res) => {
  try {
    const user = await collections.users.findById(req.user.id);
    res.json({
      id: user.id,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/posts
 * Get all posts for current user
 */
router.get('/api/posts', authMiddleware, async (req, res) => {
  try {
    const posts = await collections.posts.findMany({
      authorId: req.user.id
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/posts
 * Create a new post
 */
router.post('/api/posts', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Title and content are required'
      });
    }

    const post = await collections.posts.create({
      title,
      content,
      authorId: req.user.id
    });

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
