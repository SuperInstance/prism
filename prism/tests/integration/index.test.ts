/**
 * Integration Tests Entry Point
 *
 * This file serves as the entry point for all integration tests.
 * Integration tests verify that multiple components work together.
 */

// Import all integration test files to ensure they're discovered

// Workflow integration tests
import './indexing-workflow.test.js';
import './search-workflow.test.js';

/**
 * Integration Test Suite Overview
 *
 * Integration tests verify that different components work together correctly.
 * They use real databases (in-memory), real file I/O, and test component
 * boundaries rather than implementation details.
 *
 * Test Categories:
 * ---------------
 * - Indexing Workflow: File discovery → parsing → chunking → storage
 * - Search Workflow: Query processing → vector search → ranking → context
 * - Configuration Workflow: Load → validate → merge → use
 * - CLI Workflow: Command parsing → execution → output
 *
 * Running Integration Tests:
 * -------------------------
 * - All integration tests: npm run test:integration
 * - Specific file: npx vitest tests/integration/indexing-workflow.test.ts
 * - With coverage: npx vitest run tests/integration --coverage
 *
 * Integration Test Principles:
 * ---------------------------
 * 1. Test real interactions between components
 * 2. Use in-memory databases for speed
 * 3. Use temporary directories for file operations
 * 4. Avoid mocking internal implementation
 * 5. Focus on component boundaries
 * 6. Clean up resources after each test
 *
 * Coverage Goals:
 * --------------
 * - Overall: 70%
 * - Critical workflows: 95%
 * - Component interactions: 80%
 */
