#!/usr/bin/env node

/**
 * Simple test script for PRISM server
 */

const http = require('http');

// Test function
function testEndpoint(url, description) {
  return new Promise((resolve) => {
    console.log(`Testing ${description}: ${url}`);

    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`  ✅ Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(`  ✅ Response: ${JSON.stringify(json).substring(0, 100)}...`);
        } catch {
          console.log(`  ✅ Response: ${data.substring(0, 100)}...`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`  ❌ Error: ${error.message}`);
      resolve();
    });

    req.setTimeout(5000, () => {
      console.log('  ❌ Timeout');
      req.destroy();
      resolve();
    });
  });
}

// Run tests
async function runTests() {
  console.log('🧪 Testing PRISM Server\n');

  const tests = [
    { url: 'http://localhost:8080/health', description: 'Health check' },
    { url: 'http://localhost:8080/project', description: 'Project info' },
    { url: 'http://localhost:8080/nonexistent', description: '404 endpoint' }
  ];

  for (const test of tests) {
    await testEndpoint(test.url, test.description);
    console.log();
  }

  console.log('✅ Tests completed!');
}

// Check if server is running first
http.get('http://localhost:8080/health', () => {
  runTests();
}).on('error', () => {
  console.log('❌ Server is not running. Please start it first:');
  console.log('  npm start');
  process.exit(1);
});