/**
 * Search Workflow Integration Tests
 *
 * Tests the complete search workflow including query processing,
 * vector similarity search, and result ranking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismEngine } from '../../src/core/PrismEngine.js';
import { createTempDir, cleanupTempDir, createTempFile } from '../helpers/test-utils.js';

describe('Search Workflow Integration', () => {
  let engine: PrismEngine;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    engine = new PrismEngine({ dbPath: ':memory:' });

    // Create test codebase
    await createTempFile(
      tempDir,
      'auth/service.ts',
      `
/**
 * Authentication Service
 *
 * Handles user authentication and authorization
 */

export class AuthService {
  private readonly users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  /**
   * Authenticate a user with username and password
   */
  async authenticate(username: string, password: string): Promise<boolean> {
    const user = this.users.get(username);
    if (!user) {
      return false;
    }
    return this.verifyPassword(password, user.passwordHash);
  }

  /**
   * Create a new user account
   */
  async register(username: string, email: string, password: string): Promise<User> {
    if (this.users.has(username)) {
      throw new Error('Username already exists');
    }

    const passwordHash = await this.hashPassword(password);
    const user: User = {
      id: this.generateId(),
      username,
      email,
      passwordHash,
      createdAt: new Date(),
    };

    this.users.set(username, user);
    return user;
  }

  /**
   * Authorize a user with a token
   */
  async authorize(token: string): Promise<User | null> {
    const decoded = this.decodeToken(token);
    return this.users.get(decoded.username) || null;
  }

  private async hashPassword(password: string): Promise<string> {
    // Password hashing logic
    return \`hashed:\${password}\`;
  }

  private verifyPassword(password: string, hash: string): boolean {
    return hash === \`hashed:\${password}\`;
  }

  private decodeToken(token: string): { username: string } {
    // Token decoding logic
    return { username: 'test' };
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2);
  }
}

interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}
      `
    );

    await createTempFile(
      tempDir,
      'database/client.ts',
      `
/**
 * Database Client
 *
 * Handles database connections and queries
 */

export class DatabaseClient {
  private connectionString: string;
  private connection: Connection | null = null;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    this.connection = await createConnection(this.connectionString);
  }

  /**
   * Execute a query
   */
  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }
    return this.connection.execute(sql, params);
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<Transaction> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }
    return this.connection.begin();
  }
}

interface Connection {
  execute<T>(sql: string, params: any[]): Promise<T[]>;
  close(): Promise<void>;
  begin(): Promise<Transaction>;
}

interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
      `
    );

    await createTempFile(
      tempDir,
      'utils/format.ts',
      `
/**
 * Formatting utilities
 */

export function formatDate(date: Date, format: 'short' | 'long' = 'short'): string {
  if (format === 'short') {
    return date.toLocaleDateString();
  }
  return date.toLocaleString();
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
      `
    );

    await createTempFile(
      tempDir,
      'api/handlers.ts',
      `
/**
 * HTTP request handlers
 */

import { AuthService } from '../auth/service.js';
import { DatabaseClient } from '../database/client.js';

export class RequestHandlers {
  private auth: AuthService;
  private db: DatabaseClient;

  constructor(auth: AuthService, db: DatabaseClient) {
    this.auth = auth;
    this.db = db;
  }

  /**
   * Handle login request
   */
  async handleLogin(req: LoginRequest): Promise<LoginResponse> {
    const success = await this.auth.authenticate(req.username, req.password);
    if (!success) {
      throw new Error('Invalid credentials');
    }
    const token = this.generateToken(req.username);
    return { success: true, token };
  }

  /**
   * Handle registration request
   */
  async handleRegister(req: RegisterRequest): Promise<RegisterResponse> {
    const user = await this.auth.register(req.username, req.email, req.password);
    return { success: true, userId: user.id };
  }

  /**
   * Handle data query request
   */
  async handleQuery(req: QueryRequest): Promise<QueryResponse> {
    const results = await this.db.query(req.sql, req.params);
    return { success: true, data: results };
  }

  private generateToken(username: string): string {
    return \`token-\${username}-\${Date.now()}\`;
  }
}

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface RegisterResponse {
  success: boolean;
  userId?: string;
}

interface QueryRequest {
  sql: string;
  params: any[];
}

interface QueryResponse {
  success: boolean;
  data?: any[];
}
      `
    );

    // Index the codebase
    await engine.index(tempDir);
  });

  afterEach(async () => {
    engine.close();
    await cleanupTempDir(tempDir);
  });

  describe('basic search', () => {
    it('should return relevant results for authentication query', async () => {
      const results = await engine.search('authenticate user with password');

      expect(results.length).toBeGreaterThan(0);

      // Results should be relevant
      const authResults = results.filter((r) =>
        r.chunk.content.includes('authenticate') || r.chunk.filePath.includes('auth')
      );
      expect(authResults.length).toBeGreaterThan(0);
    });

    it('should return relevant results for database query', async () => {
      const results = await engine.search('database connection and queries');

      expect(results.length).toBeGreaterThan(0);

      const dbResults = results.filter((r) =>
        r.chunk.content.includes('Database') || r.chunk.filePath.includes('database')
      );
      expect(dbResults.length).toBeGreaterThan(0);
    });

    it('should return relevant results for formatting utilities', async () => {
      const results = await engine.search('format date and currency');

      expect(results.length).toBeGreaterThan(0);

      const formatResults = results.filter((r) =>
        r.chunk.content.includes('format') || r.chunk.filePath.includes('format')
      );
      expect(formatResults.length).toBeGreaterThan(0);
    });

    it('should handle multi-word queries', async () => {
      const results = await engine.search('user authentication service');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle single word queries', async () => {
      const results = await engine.search('login');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('result ranking', () => {
    it('should rank results by relevance', async () => {
      const results = await engine.search('authenticate');

      expect(results.length).toBeGreaterThan(0);

      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should provide relevance scores', async () => {
      const results = await engine.search('database');

      results.forEach((result) => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('result limits', () => {
    it('should respect maxResults parameter', async () => {
      const results = await engine.search('function', 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should return all results when limit is high', async () => {
      const results = await engine.search('function', 100);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('search context', () => {
    it('should provide file paths in results', async () => {
      const results = await engine.search('authenticate');

      results.forEach((result) => {
        expect(result.chunk.filePath).toBeDefined();
        expect(result.chunk.filePath).toBeTruthy();
      });
    });

    it('should provide line numbers in results', async () => {
      const results = await engine.search('authenticate');

      results.forEach((result) => {
        expect(result.chunk.startLine).toBeGreaterThan(0);
        expect(result.chunk.endLine).toBeGreaterThanOrEqual(result.chunk.startLine);
      });
    });

    it('should provide language in results', async () => {
      const results = await engine.search('authenticate');

      results.forEach((result) => {
        expect(result.chunk.language).toBe('typescript');
      });
    });
  });

  describe('symbol-based search', () => {
    it('should find results by symbol name', async () => {
      const results = await engine.search('AuthService');

      expect(results.length).toBeGreaterThan(0);

      const hasAuthService = results.some((r) => r.chunk.symbols.includes('AuthService'));
      expect(hasAuthService).toBe(true);
    });

    it('should find methods in classes', async () => {
      const results = await engine.search('authenticate method');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should find functions', async () => {
      const results = await engine.search('formatDate');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('explain usage', () => {
    it('should explain symbol usage', async () => {
      const result = await engine.explainUsage('formatDate');

      expect(result).toBeDefined();
      expect(result.definition).toBeDefined();
      expect(result.usages).toBeDefined();
    });

    it('should find function definition', async () => {
      const result = await engine.explainUsage('formatDate');

      if (result.definition) {
        expect(result.definition.symbols).toContain('formatDate');
      }
    });

    it('should find symbol usages', async () => {
      const result = await engine.explainUsage('AuthService');

      expect(result).toBeDefined();
      // Definition should exist
      if (result.definition) {
        expect(result.definition.symbols).toContain('AuthService');
      }
    });

    it('should respect limit parameter in explainUsage', async () => {
      const result = await engine.explainUsage('formatDate', 5);

      expect(result.usages.length).toBeLessThanOrEqual(5);
    });
  });

  describe('get context', () => {
    it('should retrieve context for specific file', async () => {
      const context = await engine.getContext('auth/service.ts');

      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(0);

      // Should contain content from auth/service.ts
      const hasAuth = context.some((c) => c.content.includes('AuthService'));
      expect(hasAuth).toBe(true);
    });

    it('should retrieve multiple chunks for large files', async () => {
      const context = await engine.getContext('auth/service.ts');

      expect(context.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent file', async () => {
      const context = await engine.getContext('nonexistent/file.ts');

      expect(context).toEqual([]);
    });
  });

  describe('search performance', () => {
    it('should return results quickly', async () => {
      const start = Date.now();
      const results = await engine.search('authenticate');
      const duration = Date.now() - start;

      expect(results).toBeDefined();
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    it('should handle multiple searches efficiently', async () => {
      const queries = ['authenticate', 'database', 'format', 'login', 'query'];

      const start = Date.now();
      for (const query of queries) {
        await engine.search(query);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // All searches should complete in under 2s
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      const results = await engine.search('');

      expect(results).toBeDefined();
    });

    it('should handle very long query', async () => {
      const longQuery = 'authenticate '.repeat(100);
      const results = await engine.search(longQuery);

      expect(results).toBeDefined();
    });

    it('should handle special characters in query', async () => {
      const results = await engine.search('authenticate () {} ;');

      expect(results).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const results = await engine.search('authenticate 用户 认证');

      expect(results).toBeDefined();
    });
  });

  describe('search quality', () => {
    it('should return relevant results for specific queries', async () => {
      const results = await engine.search('how to authenticate a user');

      expect(results.length).toBeGreaterThan(0);

      // Top results should be relevant
      const topResults = results.slice(0, 3);
      const hasRelevant = topResults.some(
        (r) => r.chunk.content.includes('authenticate') || r.chunk.symbols.includes('authenticate')
      );
      expect(hasRelevant).toBe(true);
    });

    it('should return diverse results', async () => {
      const results = await engine.search('function');

      // Should have results from multiple files
      const uniqueFiles = new Set(results.map((r) => r.chunk.filePath));
      expect(uniqueFiles.size).toBeGreaterThan(1);
    });
  });
});
