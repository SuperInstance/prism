#!/usr/bin/env node

/**
 * File Watcher Demo
 * Demonstrates automatic reindexing when files change
 */

const PrismDaemon = require('../daemon/server');
const fs = require('fs').promises;
const path = require('path');

async function demo() {
  console.log('🎬 File Watcher Demo\n');
  console.log('This demo shows how the file watcher automatically updates the index when files change.\n');

  // Create demo directory
  const demoDir = path.join(__dirname, 'demo-watcher-tmp');
  await fs.rm(demoDir, { recursive: true, force: true });
  await fs.mkdir(demoDir, { recursive: true });
  await fs.writeFile(path.join(demoDir, 'example.js'), 'console.log("hello");');

  // Set environment for daemon
  process.env.PROJECT_ROOT = demoDir;
  process.env.PORT = '8888';
  process.env.ENABLE_WATCHER = 'true';

  // Create and start daemon
  const daemon = new PrismDaemon();
  await daemon.start();

  console.log('\n✓ Daemon started with file watcher enabled');
  console.log('\n📊 Initial index stats:');
  const initialIndex = await daemon.indexer.loadIndex();
  console.log(`   Files indexed: ${initialIndex.file_count}`);

  // Wait a moment
  await wait(1000);

  // Make changes
  console.log('\n🔄 Making changes to demonstrate auto-reindexing...\n');

  // Create a file
  console.log('1. Creating new file: demo-new.js');
  await fs.writeFile(path.join(demoDir, 'demo-new.js'), 'const x = 42;');
  await wait(1000);

  // Modify a file
  console.log('2. Modifying existing file: example.js');
  await fs.writeFile(path.join(demoDir, 'example.js'), 'console.log("world");');
  await wait(1000);

  // Delete a file
  console.log('3. Deleting file: demo-new.js');
  await fs.unlink(path.join(demoDir, 'demo-new.js'));
  await wait(1000);

  // Check final stats
  console.log('\n📊 Final index stats:');
  const finalIndex = await daemon.indexer.loadIndex();
  console.log(`   Files indexed: ${finalIndex.file_count}`);
  console.log(`   Last indexed: ${finalIndex.indexed_at}`);

  // Show watcher stats
  const watcherStats = daemon.watcher.getStats();
  console.log('\n📊 Watcher statistics:');
  console.log(`   Files changed: ${watcherStats.filesChanged}`);
  console.log(`   Files created: ${watcherStats.filesCreated}`);
  console.log(`   Files deleted: ${watcherStats.filesDeleted}`);
  console.log(`   Watching: ${watcherStats.isWatching}`);
  console.log(`   Directories watched: ${watcherStats.watchedDirectories}`);

  // Cleanup
  await daemon.stop();
  await fs.rm(demoDir, { recursive: true, force: true });

  console.log('\n✅ Demo complete!\n');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

demo().catch(error => {
  console.error('Demo failed:', error);
  process.exit(1);
});
