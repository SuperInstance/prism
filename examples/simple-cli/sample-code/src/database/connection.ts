// Database connection module
// Handles database connections and queries

import { Pool, PoolConfig } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

class Database {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      this.isConnected = true;
      console.log('Database connected successfully');
      client.release();
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query(text: string, params?: any[]) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    console.log('Database disconnected');
  }
}

// Database configuration
const config: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'myapp',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
};

// Create database instance
export const database = new Database(config);

// Database collections (tables)
export const collections = {
  users: {
    async findOne(query: any) {
      const result = await database.query(
        'SELECT * FROM users WHERE username = $1',
        [query.username]
      );
      return result.rows[0];
    },

    async findById(id: string) {
      const result = await database.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0];
    },

    async create(data: any) {
      const result = await database.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
        [data.username, data.email, data.passwordHash]
      );
      return result.rows[0];
    },
  },

  posts: {
    async findMany(query: any) {
      const result = await database.query(
        'SELECT * FROM posts WHERE author_id = $1',
        [query.authorId]
      );
      return result.rows;
    },

    async create(data: any) {
      const result = await database.query(
        'INSERT INTO posts (title, content, author_id) VALUES ($1, $2, $3) RETURNING *',
        [data.title, data.content, data.authorId]
      );
      return result.rows[0];
    },
  },
};
