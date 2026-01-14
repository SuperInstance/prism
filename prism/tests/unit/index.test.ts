/**
 * Unit Tests Entry Point
 *
 * This file serves as the entry point for all unit tests.
 * Individual test files are organized by module.
 */

// Import all unit test files to ensure they're discovered by the test runner

// Core module tests
import './core/PrismEngine.test.js';

// Token optimizer tests
import './token-optimizer/TokenOptimizer.test.js';

// Scoring service tests
import './scoring/ScoringService.test.js';

// Config loader tests
import './config/loader.test.js';

// Vector DB tests
import './vector-db.test.js';

/**
 * Unit Test Suite Overview
 *
 * Test Organization:
 * -------------------
 * - /tests/unit/core/ - Core engine and type tests
 * - /tests/unit/token-optimizer/ - Token optimization tests
 * - /tests/unit/scoring/ - Relevance scoring tests
 * - /tests/unit/config/ - Configuration management tests
 * - /tests/unit/vector-db/ - Vector database tests
 * - /tests/unit/cli/ - CLI command tests
 * - /tests/unit/utils/ - Utility function tests
 *
 * Running Tests:
 * --------------
 * - All tests: npm test
 * - Unit only: npm run test:unit
 * - Specific file: npx vitest tests/unit/core/PrismEngine.test.ts
 * - Watch mode: npx vitest --watch
 * - Coverage: npm run test:coverage
 *
 * Coverage Goals:
 * --------------
 * - Overall: 80%
 * - Core: 90%
 * - Vector DB: 85%
 * - Token Optimizer: 85%
 * - Scoring: 80%
 * - Config: 90%
 * - CLI: 75%
 */
