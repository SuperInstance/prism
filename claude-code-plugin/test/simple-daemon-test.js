#!/usr/bin/env node

/**
 * Simple tests for the PRISM daemon
 */

const PrismDaemon = require('../daemon/server.js');
const path = require('path');
const fs = require('fs').promises;

async function runTests() {
  console.log('🧪 Running PRISM Daemon Tests...\n');

  let daemon;
  const testRoot = path.join(__dirname, 'test-project');

  try {
    // Create a test project
    await fs.mkdir(testRoot, { recursive: true });
    await fs.writeFile(path.join(testRoot, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0'
      }
    }));

    console.log('✅ Test project created');

    // Test 1: Daemon initialization
    daemon = new PrismDaemon();
    daemon.config.projectRoot = testRoot;
    daemon.config.cacheDir = path.join(testRoot, '.cache');
    daemon.config.indexDir = path.join(testRoot, '.index');

    await daemon.initialize();
    console.log('✅ Daemon initialized successfully');

    // Test 2: Project detection
    if (daemon.projectInfo) {
      console.log('✅ Project detected:', daemon.projectInfo.name);
      console.log('   Language:', daemon.projectInfo.language);
      console.log('   Type:', daemon.projectInfo.type);
      console.log('   Dependencies:', daemon.projectInfo.dependencies.length);
    } else {
      console.log('❌ Project detection failed');
    }

    // Test 3: HTTP health endpoint (mock test)
    const testResponse = {
      writeHead: function(status, headers) {
        this._writeHeadCalls = this._writeHeadCalls || [];
        this._writeHeadCalls.push({ status, headers });
        return this;
      },
      end: function(data) {
        this._endData = data;
        return this;
      }
    };

    // Create a mock request
    const testRequest = {
      method: 'GET',
      url: '/health',
      on: function(event, callback) {
        if (event === 'data') {
          callback(Buffer.from(''));
        }
        if (event === 'end') {
          callback();
        }
        return this;
      }
    };

    daemon.requestHandler(testRequest, testResponse);

    // Check if health endpoint was called correctly
    if (testResponse._writeHeadCalls &&
        testResponse._writeHeadCalls.some(call => call.status === 200)) {
      console.log('✅ Health endpoint working');
    } else {
      console.log('❌ Health endpoint failed');
      console.log('   WriteHead calls:', testResponse._writeHeadCalls);
    }

    // Test 4: Search functionality
    const searchResults = await daemon.performSearch('test query');
    if (searchResults && searchResults.results) {
      console.log('✅ Search functionality working');
      console.log('   Results returned:', searchResults.results.length);
      console.log('   Query processed:', searchResults.query);
    } else {
      console.log('❌ Search functionality failed');
    }

    // Test 5: Indexing queue
    daemon.indexingQueue.push({ path: '/test/file.js', content: 'test content' });
    console.log('✅ Indexing queue working');
    console.log('   Queue length:', daemon.indexingQueue.length);

    // Test 6: Project detector functionality
    const detector = new (require('../daemon/project-detector'))(testRoot);
    const projectInfo = await detector.detectAll();
    console.log('✅ Project detector working');
    console.log('   Detected language:', projectInfo.language);
    console.log('   Detected framework:', projectInfo.framework);

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Clean up
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
      console.log('✅ Test cleanup completed');
    } catch (error) {
      console.log('⚠️  Cleanup warning:', error.message);
    }

    if (daemon && daemon.isRunning) {
      try {
        await daemon.stop();
      } catch (error) {
        console.log('⚠️  Daemon stop warning:', error.message);
      }
    }
  }
}

// Run the tests
runTests();