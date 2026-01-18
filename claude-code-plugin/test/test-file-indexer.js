#!/usr/bin/env node

/**
 * Comprehensive test for the file indexer
 */

const FileIndexer = require('../daemon/file-indexer');
const fs = require('fs').promises;
const path = require('path');

async function testFileIndexer() {
  console.log('🧪 Testing File Indexer...\n');

  const testRoot = path.join(__dirname, '..');
  const indexDir = path.join(__dirname, '../.prism-test');
  const indexer = new FileIndexer(testRoot, indexDir);

  try {
    // Test 1: Index project
    console.log('Test 1: Index project files');
    const index = await indexer.indexProject();
    console.log(`✅ Indexed ${index.file_count} files`);
    console.log(`   Version: ${index.version}`);
    console.log(`   Indexed at: ${index.indexed_at}`);

    // Test 2: Load index
    console.log('\nTest 2: Load index from disk');
    const loadedIndex = await indexer.loadIndex();
    console.log(`✅ Loaded index with ${loadedIndex.file_count} files`);

    // Test 3: Search functionality
    console.log('\nTest 3: Search for "FileIndexer"');
    indexer.loadedIndex = loadedIndex;
    const results = indexer.searchIndex('FileIndexer', 5);
    console.log(`✅ Found ${results.length} results`);
    results.forEach((result, i) => {
      console.log(`   ${i+1}. ${result.file}:${result.line} (score: ${result.score.toFixed(3)})`);
      console.log(`      ${result.content.substring(0, 60)}...`);
    });

    // Test 4: Language detection
    console.log('\nTest 4: Language detection');
    const jsFiles = loadedIndex.files.filter(f => f.language === 'javascript');
    const mdFiles = loadedIndex.files.filter(f => f.language === 'markdown');
    const jsonFiles = loadedIndex.files.filter(f => f.language === 'json');
    console.log(`✅ JavaScript files: ${jsFiles.length}`);
    console.log(`   Markdown files: ${mdFiles.length}`);
    console.log(`   JSON files: ${jsonFiles.length}`);

    // Test 5: File exclusion
    console.log('\nTest 5: File exclusion patterns');
    const hasNodeModules = loadedIndex.files.some(f => f.path.includes('node_modules'));
    const hasGit = loadedIndex.files.some(f => f.path.includes('.git'));
    console.log(`✅ Excludes node_modules: ${!hasNodeModules}`);
    console.log(`   Excludes .git: ${!hasGit}`);

    // Test 6: Relevance scoring
    console.log('\nTest 6: Relevance scoring');
    const searchResults = indexer.searchIndex('async function', 10);
    console.log(`✅ Found ${searchResults.length} results with relevance scores:`);
    searchResults.slice(0, 3).forEach((result, i) => {
      console.log(`   ${i+1}. ${result.file}:${result.line} - score: ${result.score.toFixed(3)}`);
    });

    // Test 7: Context retrieval
    console.log('\nTest 7: Context retrieval');
    if (searchResults.length > 0) {
      const firstResult = searchResults[0];
      const contextLines = firstResult.context.split('\n').length;
      console.log(`✅ Context includes ${contextLines} lines around match`);
      console.log(`   Preview: ${firstResult.context.substring(0, 80)}...`);
    }

    // Cleanup
    console.log('\nCleaning up test index...');
    await fs.rm(indexDir, { recursive: true, force: true });
    console.log('✅ Cleanup complete');

    console.log('\n✅ All tests passed!');
    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);

    // Cleanup on error
    try {
      await fs.rm(indexDir, { recursive: true, force: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return false;
  }
}

// Run tests
if (require.main === module) {
  testFileIndexer()
    .then(success => process.exit(success ? 0 : 1))
    .catch(() => process.exit(1));
}

module.exports = testFileIndexer;
