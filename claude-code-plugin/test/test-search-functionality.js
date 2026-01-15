#!/usr/bin/env node

/**
 * Test search functionality
 */

const PrismDaemon = require('../daemon/server.js');
const path = require('path');
const fs = require('fs').promises;

async function testSearchFunctionality() {
  console.log('🔍 Testing Search Functionality...\n');

  let daemon;
  const testRoot = path.join(__dirname, 'search-test-project');

  try {
    // Create test project with various files
    await fs.mkdir(testRoot, { recursive: true });

    // Create package.json
    await fs.writeFile(path.join(testRoot, 'package.json'), JSON.stringify({
      name: 'search-test-project',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0',
        react: '^18.0.0',
        lodash: '^4.17.0'
      }
    }, null, 2));

    // Create source files with different content
    const sourceFiles = [
      {
        path: 'src/auth.js',
        content: `
// Authentication middleware
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
        `
      },
      {
        path: 'src/database.js',
        content: `
// Database connection
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
        `
      },
      {
        path: 'src/utils/helpers.js',
        content: `
// Utility functions
const _ = require('lodash');

const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const paginate = (array, page, perPage) => {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return array.slice(start, end);
};

module.exports = { formatDate, validateEmail, paginate };
        `
      },
      {
        path: 'tests/auth.test.js',
        content: `
// Authentication tests
const request = require('supertest');
const app = require('../src/server');
const { authenticateToken } = require('../src/auth');

describe('Authentication', () => {
  test('should login user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    expect(response.statusCode).toBe(200);
  });

  test('should protect routes', async () => {
    const response = await request(app)
      .get('/api/protected');

    expect(response.statusCode).toBe(401);
  });
});
        `
      },
      {
        path: 'README.md',
        content: `
# Search Test Project

This is a test project for validating search functionality.

## Features

- Authentication system with JWT
- Database connection with MongoDB
- Utility functions for common operations
- Test suite with Jest

## Getting Started

1. Install dependencies: \`npm install\`
2. Set environment variables
3. Run tests: \`npm test\`

## API Endpoints

- POST /api/auth/login - User login
- GET /api/protected - Protected route
- POST /api/users - Create user
        `
      }
    ];

    // Create all source files
    for (const file of sourceFiles) {
      const fullPath = path.join(testRoot, file.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.content);
    }

    console.log('✅ Test project created with source files');

    // Initialize daemon
    daemon = new PrismDaemon();
    daemon.config.projectRoot = testRoot;
    daemon.config.cacheDir = path.join(testRoot, '.cache');
    daemon.config.indexDir = path.join(testRoot, '.index');

    await daemon.initialize();
    console.log('✅ Daemon initialized');

    // Test search functionality
    const searchTests = [
      {
        query: 'authentication middleware',
        expectedResults: ['auth.js'],
        description: 'Should find authentication middleware'
      },
      {
        query: 'database connection',
        expectedResults: ['database.js'],
        description: 'Should find database connection'
      },
      {
        query: 'JWT token verification',
        expectedResults: ['auth.js'],
        description: 'Should find JWT-related code'
      },
      {
        query: 'utility functions helper',
        expectedResults: ['helpers.js'],
        description: 'Should find utility functions'
      },
      {
        query: 'test cases jest',
        expectedResults: ['auth.test.js'],
        description: 'Should find test files'
      },
      {
        query: 'MongoDB connection',
        expectedResults: ['database.js'],
        description: 'Should find MongoDB connection'
      },
      {
        query: 'email validation regex',
        expectedResults: ['helpers.js'],
        description: 'Should find email validation'
      },
      {
        query: 'API endpoints documentation',
        expectedResults: ['README.md'],
        description: 'Should find API documentation'
      }
    ];

    console.log('\n🔍 Running Search Tests...');
    console.log('================================');

    let passedTests = 0;
    let totalTests = searchTests.length;

    for (const test of searchTests) {
      console.log(`\nTesting: ${test.description}`);

      try {
        const results = daemon.simpleSearch(test.query);

        if (results && results.length > 0) {
          const foundFiles = results.map(r => r.file);
          const hasExpectedResult = test.expectedResults.some(expected =>
            foundFiles.some(found => found.includes(expected))
          );

          if (hasExpectedResult) {
            console.log(`  ✅ Found: ${foundFiles.join(', ')}`);
            passedTests++;
          } else {
            console.log(`  ❌ Expected files containing: ${test.expectedResults.join(', ')}`);
            console.log(`     Found: ${foundFiles.join(', ') || 'none'}`);
          }
        } else {
          console.log(`  ❌ No results found for query: "${test.query}"`);
        }
      } catch (error) {
        console.log(`  ❌ Error searching for "${test.query}": ${error.message}`);
      }
    }

    // Test search with edge cases
    console.log('\n🔍 Edge Case Tests...');
    console.log('================================');

    const edgeCaseTests = [
      { query: '', description: 'Empty query' },
      { query: 'a', description: 'Single character query' },
      { query: '   ', description: 'Whitespace only' },
      { query: 'very long query with many words that should not match anything specific', description: 'Very long query' }
    ];

    for (const test of edgeCaseTests) {
      try {
        const results = daemon.simpleSearch(test.query);
        console.log(`\n${test.description}: ${results.length} results`);
        if (results.length > 0) {
          console.log(`  Results: ${results.map(r => r.file).join(', ')}`);
        }
      } catch (error) {
        console.log(`\n${test.description}: Error - ${error.message}`);
      }
    }

    // Test relevance scoring
    console.log('\n🔍 Testing Relevance Scoring...');
    console.log('================================');

    const scoringTests = [
      { query: 'auth', expectedPrimary: 'auth.js' },
      { query: 'database', expectedPrimary: 'database.js' },
      { query: 'test', expectedPrimary: 'auth.test.js' },
      { query: 'readme', expectedPrimary: 'README.md' }
    ];

    for (const test of scoringTests) {
      const results = daemon.simpleSearch(test.query);
      if (results.length > 0) {
        const topResult = results[0];
        console.log(`Query "${test.query}": Top result = ${topResult.file} (score: ${topResult.score})`);

        if (topResult.file.includes(test.expectedPrimary)) {
          console.log(`  ✅ Correct primary result`);
        } else {
          console.log(`  ⚠️  Expected primary: ${test.expectedPrimary}`);
        }
      }
    }

    console.log('\n📊 Search Functionality Summary:');
    console.log('================================');
    console.log(`Regular tests: ${passedTests}/${totalTests} passed`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      console.log('🎉 All search tests passed!');
    } else {
      console.log('⚠️  Some search tests failed - see results above');
    }

  } catch (error) {
    console.error('\n❌ Search test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Clean up
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
      console.log('\n✅ Test cleanup completed');
    } catch (error) {
      console.log('⚠️  Cleanup warning:', error.message);
    }
  }
}

// Run the test
testSearchFunctionality();