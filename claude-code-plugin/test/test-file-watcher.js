#!/usr/bin/env node

/**
 * Test file watcher functionality
 * Tests: create, modify, delete, debouncing, memory leaks
 */

const fs = require('fs').promises;
const path = require('path');
const FileWatcher = require('../daemon/file-watcher');
const FileIndexer = require('../daemon/file-indexer');

// Test configuration
const TEST_DIR = path.join(__dirname, 'test-watcher-tmp');
const PRISM_DIR = path.join(TEST_DIR, '.prism');
const DEBOUNCE_WAIT = 600; // Slightly longer than default debounce (500ms)

// Test utilities
class TestHarness {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  async test(name, fn) {
    process.stdout.write(`  ${name}... `);
    try {
      await fn();
      console.log('✓ PASS');
      this.passed++;
      this.tests.push({ name, status: 'pass' });
    } catch (error) {
      console.log(`✗ FAIL: ${error.message}`);
      this.failed++;
      this.tests.push({ name, status: 'fail', error: error.message });
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  async cleanup() {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  summary() {
    console.log('\n' + '='.repeat(50));
    console.log(`Tests: ${this.passed + this.failed}`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log('='.repeat(50));
    return this.failed === 0;
  }
}

// Wait helper
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main test suite
async function runTests() {
  const harness = new TestHarness();
  let watcher = null;
  let indexer = null;

  console.log('\n🧪 File Watcher Test Suite\n');

  // Setup
  await harness.test('Setup test environment', async () => {
    await harness.cleanup();
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(PRISM_DIR, { recursive: true });

    // Create initial test files
    await fs.writeFile(path.join(TEST_DIR, 'test1.js'), 'console.log("test1");');
    await fs.writeFile(path.join(TEST_DIR, 'test2.js'), 'console.log("test2");');
  });

  // Test 1: FileWatcher instantiation
  await harness.test('Create FileWatcher instance', async () => {
    watcher = new FileWatcher(TEST_DIR);
    harness.assert(watcher !== null, 'Watcher should be created');
    harness.assert(!watcher.isWatching, 'Watcher should not be watching initially');
  });

  // Test 2: Start watching
  await harness.test('Start file watcher', async () => {
    await watcher.start();
    harness.assert(watcher.isWatching, 'Watcher should be watching');
    const stats = watcher.getStats();
    harness.assert(stats.isWatching === true, 'Stats should show watching');
  });

  // Test 3: File creation detection
  await harness.test('Detect file creation or change', async () => {
    let eventDetected = false;
    watcher.once('fileCreated', () => {
      eventDetected = true;
    });
    watcher.once('fileChanged', () => {
      eventDetected = true;
    });

    await fs.writeFile(path.join(TEST_DIR, 'new-file.js'), 'console.log("new");');
    await wait(DEBOUNCE_WAIT);

    harness.assert(eventDetected, 'File creation/change should be detected');
    const stats = watcher.getStats();
    harness.assert(stats.filesCreated + stats.filesChanged >= 1, 'Stats should show files created or changed');
  });

  // Test 4: File modification detection
  await harness.test('Detect file modification', async () => {
    let fileChanged = false;
    watcher.once('fileChanged', () => {
      fileChanged = true;
    });

    await fs.writeFile(path.join(TEST_DIR, 'test1.js'), 'console.log("modified");');
    await wait(DEBOUNCE_WAIT);

    harness.assert(fileChanged, 'File modification should be detected');
    const stats = watcher.getStats();
    harness.assert(stats.filesChanged >= 1, 'Stats should show files changed');
  });

  // Test 5: File deletion detection
  await harness.test('Detect file deletion', async () => {
    let fileDeleted = false;
    watcher.once('fileDeleted', () => {
      fileDeleted = true;
    });

    await fs.unlink(path.join(TEST_DIR, 'test2.js'));
    await wait(DEBOUNCE_WAIT);

    harness.assert(fileDeleted, 'File deletion should be detected');
    const stats = watcher.getStats();
    harness.assert(stats.filesDeleted >= 1, 'Stats should show files deleted');
  });

  // Test 6: Debouncing (rapid changes should be debounced)
  await harness.test('Test debouncing', async () => {
    let changeCount = 0;
    const handler = () => changeCount++;
    watcher.on('fileChanged', handler);

    // Make multiple rapid changes
    const testFile = path.join(TEST_DIR, 'debounce-test.js');
    await fs.writeFile(testFile, 'v1');
    await wait(50);
    await fs.writeFile(testFile, 'v2');
    await wait(50);
    await fs.writeFile(testFile, 'v3');
    await wait(DEBOUNCE_WAIT);

    watcher.off('fileChanged', handler);

    // Should only trigger once due to debouncing
    harness.assert(changeCount === 1, `Should debounce changes (got ${changeCount} events)`);
  });

  // Test 7: Exclusion patterns
  await harness.test('Test exclusion patterns', async () => {
    let nodeModulesDetected = false;
    watcher.once('fileCreated', () => {
      nodeModulesDetected = true;
    });

    // Create node_modules directory and file
    await fs.mkdir(path.join(TEST_DIR, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, 'node_modules', 'test.js'), 'ignored');
    await wait(DEBOUNCE_WAIT);

    harness.assert(!nodeModulesDetected, 'node_modules should be excluded');
  });

  // Test 8: Integration with FileIndexer
  await harness.test('Integration with FileIndexer', async () => {
    indexer = new FileIndexer(TEST_DIR, PRISM_DIR);
    await indexer.indexProject();

    const updatePromise = new Promise((resolve) => {
      const handler = async ({ fullPath }) => {
        try {
          await indexer.updateFile(fullPath);
          resolve(true);
        } catch (error) {
          resolve(false);
        }
      };
      watcher.once('fileCreated', handler);
      watcher.once('fileChanged', handler);
    });

    await fs.writeFile(path.join(TEST_DIR, 'indexed-file.js'), 'console.log("indexed");');

    const indexUpdated = await Promise.race([
      updatePromise,
      wait(DEBOUNCE_WAIT).then(() => false)
    ]);

    // Give a bit more time for the index to be saved
    await wait(100);

    harness.assert(indexUpdated, 'Index should be updated');

    const index = await indexer.loadIndex();
    const foundFile = index.files.find(f => f.name === 'indexed-file.js');
    harness.assert(foundFile !== undefined, 'New file should be in index');
  });

  // Test 9: Stats tracking
  await harness.test('Test stats tracking', async () => {
    const statsBefore = watcher.getStats();
    watcher.resetStats();
    const statsAfter = watcher.getStats();

    harness.assert(statsAfter.filesChanged === 0, 'Stats should be reset');
    harness.assert(statsAfter.filesCreated === 0, 'Stats should be reset');
    harness.assert(statsAfter.filesDeleted === 0, 'Stats should be reset');
  });

  // Test 10: Stop watching
  await harness.test('Stop file watcher', async () => {
    watcher.stop();
    harness.assert(!watcher.isWatching, 'Watcher should not be watching');

    // Try to trigger change (should not be detected)
    let changeDetected = false;
    watcher.once('fileChanged', () => {
      changeDetected = true;
    });

    await fs.writeFile(path.join(TEST_DIR, 'test1.js'), 'after stop');
    await wait(DEBOUNCE_WAIT);

    harness.assert(!changeDetected, 'Changes should not be detected after stop');
  });

  // Test 11: Memory leak check (simplified)
  await harness.test('Check for memory leaks', async () => {
    const watcher2 = new FileWatcher(TEST_DIR);
    await watcher2.start();

    // Create many files
    for (let i = 0; i < 50; i++) {
      await fs.writeFile(path.join(TEST_DIR, `leak-test-${i}.js`), `file ${i}`);
    }

    await wait(DEBOUNCE_WAIT);

    const stats = watcher2.getStats();
    watcher2.stop();

    // Check that pending changes are cleared
    harness.assert(stats.pendingChanges === 0 || stats.pendingChanges < 10,
      'Should not have excessive pending changes');
  });

  // Cleanup
  await harness.test('Cleanup test environment', async () => {
    if (watcher && watcher.isWatching) {
      watcher.stop();
    }
    await harness.cleanup();
  });

  // Summary
  const success = harness.summary();
  process.exit(success ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
