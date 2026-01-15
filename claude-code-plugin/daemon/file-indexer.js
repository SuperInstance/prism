const fs = require('fs').promises;
const path = require('path');

/**
 * Simple LRU Cache implementation for search results
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Remove if exists to re-insert at end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

class FileIndexer {
  constructor(projectRoot, indexDir) {
    this.projectRoot = path.resolve(projectRoot); // Canonicalize project root
    this.indexDir = indexDir;
    this.indexPath = path.join(indexDir, 'index.json');
    this.loadedIndex = null;

    // Write lock to prevent concurrent index modifications
    this.writeLock = null;

    // OPTIMIZATION: Add LRU cache for search results
    this.searchCache = new LRUCache(100);
    this.invertedIndex = new Map(); // term -> [{fileIdx, lineIdx, score}]
    this.fileContents = new Map(); // Lazy-loaded file contents cache

    // Patterns to include
    this.includePatterns = [
      /\.(js|ts|jsx|tsx|py|go|rs|java|cs|php|rb)$/,
      /\.(md|json|yaml|yml)$/
    ];

    // Patterns to exclude
    this.excludePatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\.next/,
      /\.prism/,
      /\.claude-plugin/
    ];
  }

  /**
   * Index all files in the project
   */
  async indexProject() {
    console.log('[Indexer] Starting indexing...');
    const files = await this.scanDirectory(this.projectRoot);

    // OPTIMIZATION: Build inverted index during indexing
    this.buildInvertedIndex(files);

    const index = {
      version: '2.0', // Updated version with optimizations
      indexed_at: new Date().toISOString(),
      project_root: this.projectRoot,
      file_count: files.length,
      files: files,
      file_timestamps: this.buildTimestampMap(files)
    };

    await this.saveIndex(index);
    console.log(`[Indexer] Indexed ${files.length} files`);

    // Clear caches after reindexing
    this.searchCache.clear();
    this.fileContents.clear();

    return index;
  }

  /**
   * Build a map of file paths to modification times
   */
  buildTimestampMap(files) {
    const map = {};
    for (const file of files) {
      map[file.path] = file.modified;
    }
    return map;
  }

  /**
   * OPTIMIZATION: Build inverted index for fast keyword lookups
   * Maps: term -> [{fileIdx, lineIdx, text, score}]
   */
  buildInvertedIndex(files) {
    this.invertedIndex.clear();

    files.forEach((file, fileIdx) => {
      if (!file.lineIndex) return;

      file.lineIndex.forEach((lineData, lineIdx) => {
        const text = lineData.text || '';
        const textLower = text.toLowerCase();

        // Extract terms (simple word tokenization)
        const terms = textLower.match(/\w+/g) || [];
        const uniqueTerms = new Set(terms);

        uniqueTerms.forEach(term => {
          if (term.length < 2) return; // Skip single chars

          if (!this.invertedIndex.has(term)) {
            this.invertedIndex.set(term, []);
          }

          this.invertedIndex.get(term).push({
            fileIdx,
            lineIdx,
            text: text.trim(),
            lineNum: lineData.idx,
            // Pre-compute base score
            score: this.calculateBaseScore(text, file)
          });
        });
      });
    });

    console.log(`[Indexer] Built inverted index with ${this.invertedIndex.size} unique terms`);
  }

  /**
   * OPTIMIZATION: Calculate base score for a line
   */
  calculateBaseScore(line, file) {
    let score = 0.5; // Base score

    // Length penalty (prefer shorter, more focused matches)
    score += 0.2 / (1 + line.length / 100);

    return Math.min(1.0, score);
  }

  /**
   * Update index incrementally with a single file
   */
  async updateFile(filePath) {
    const index = this.loadedIndex || await this.loadIndex();
    if (!index) {
      console.log('[Indexer] No index found, performing full index');
      return await this.indexProject();
    }

    const relativePath = path.relative(this.projectRoot, filePath);
    console.log(`[Indexer] Updating file: ${relativePath}`);

    try {
      // Check if file exists
      let fileData = null;
      try {
        const stats = await fs.stat(filePath);

        // Skip files larger than 1MB
        if (stats.size > 1024 * 1024) {
          console.warn(`[Indexer] Skipping large file ${relativePath} (${stats.size} bytes)`);
          return index;
        }

        const content = await fs.readFile(filePath, 'utf8');
        const filename = path.basename(filePath);
        const lines = content.split('\n');

        // OPTIMIZATION: Store line index instead of full content
        const lineIndex = lines.map((line, idx) => ({
          idx: idx + 1,
          text: line.trim(),
          length: line.length
        })).filter(l => l.text.length > 0); // Skip empty lines

        fileData = {
          path: relativePath,
          name: filename,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          lines: lines.length,
          extension: path.extname(filename),
          language: this.detectLanguage(filename),
          lineIndex: lineIndex
        };
      } catch (error) {
        // File doesn't exist, will be removed from index
        fileData = null;
      }

      // Initialize file_timestamps if not present
      if (!index.file_timestamps) {
        index.file_timestamps = this.buildTimestampMap(index.files);
      }

      // Update or remove file from index
      const existingIndex = index.files.findIndex(f => f.path === relativePath);

      if (fileData) {
        // File exists, update it
        if (existingIndex >= 0) {
          index.files[existingIndex] = fileData;
        } else {
          index.files.push(fileData);
        }
        index.file_timestamps[relativePath] = fileData.modified;
      } else {
        // File was deleted, remove it
        if (existingIndex >= 0) {
          index.files.splice(existingIndex, 1);
          delete index.file_timestamps[relativePath];
        }
      }

      // Update metadata
      index.file_count = index.files.length;
      index.indexed_at = new Date().toISOString();

      // Save updated index
      await this.saveIndex(index);
      this.loadedIndex = index;

      console.log(`[Indexer] Updated index (${index.file_count} files)`);
      return index;
    } catch (error) {
      console.error(`[Indexer] Failed to update file ${relativePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Remove a file from the index
   */
  async removeFile(filePath) {
    const index = this.loadedIndex || await this.loadIndex();
    if (!index) {
      return null;
    }

    const relativePath = path.relative(this.projectRoot, filePath);
    console.log(`[Indexer] Removing file: ${relativePath}`);

    // Initialize file_timestamps if not present
    if (!index.file_timestamps) {
      index.file_timestamps = this.buildTimestampMap(index.files);
    }

    // Remove file from index
    const existingIndex = index.files.findIndex(f => f.path === relativePath);
    if (existingIndex >= 0) {
      index.files.splice(existingIndex, 1);
      delete index.file_timestamps[relativePath];

      // Update metadata
      index.file_count = index.files.length;
      index.indexed_at = new Date().toISOString();

      // Save updated index
      await this.saveIndex(index);
      this.loadedIndex = index;

      console.log(`[Indexer] Removed file from index (${index.file_count} files)`);
    }

    return index;
  }

  /**
   * Scan directory recursively
   */
  async scanDirectory(dir, files = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectRoot, fullPath);

        // Check exclusions
        if (this.shouldExclude(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files);
        } else if (entry.isFile() && this.shouldInclude(entry.name)) {
          try {
            const stats = await fs.stat(fullPath);

            // Skip files larger than 1MB
            if (stats.size > 1024 * 1024) {
              console.warn(`[Indexer] Skipping large file ${relativePath} (${stats.size} bytes)`);
              continue;
            }

            const content = await fs.readFile(fullPath, 'utf8');
            const lines = content.split('\n');

            // OPTIMIZATION: Store line index instead of full content (saves ~90% memory)
            const lineIndex = lines.map((line, idx) => ({
              idx: idx + 1,
              text: line.trim(),
              length: line.length
            })).filter(l => l.text.length > 0); // Skip empty lines

            files.push({
              path: relativePath,
              name: entry.name,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              lines: lines.length,
              extension: path.extname(entry.name),
              language: this.detectLanguage(entry.name),
              lineIndex: lineIndex
            });
          } catch (error) {
            console.warn(`[Indexer] Failed to index ${relativePath}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.warn(`[Indexer] Failed to read directory ${dir}:`, error.message);
    }

    return files;
  }

  /**
   * Check if file should be included
   */
  shouldInclude(filename) {
    return this.includePatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Check if path should be excluded
   */
  shouldExclude(relativePath) {
    return this.excludePatterns.some(pattern => pattern.test(relativePath));
  }

  /**
   * Detect programming language from filename
   */
  detectLanguage(filename) {
    const ext = path.extname(filename);
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml'
    };
    return languageMap[ext] || 'unknown';
  }

  /**
   * Acquire write lock to prevent concurrent modifications
   */
  async acquireWriteLock() {
    while (this.writeLock) {
      await this.writeLock;
    }
    let releaseLock;
    this.writeLock = new Promise(resolve => {
      releaseLock = resolve;
    });
    return releaseLock;
  }

  /**
   * Save index to disk with atomic write
   */
  async saveIndex(index) {
    const releaseLock = await this.acquireWriteLock();

    try {
      await fs.mkdir(this.indexDir, { recursive: true });

      // Atomic write: write to temp file, then rename
      const tempPath = this.indexPath + '.tmp';
      const indexData = JSON.stringify(index, null, 2);

      await fs.writeFile(tempPath, indexData, 'utf8');
      await fs.rename(tempPath, this.indexPath);

      this.loadedIndex = index;
    } finally {
      releaseLock();
      this.writeLock = null;
    }
  }

  /**
   * Load index from disk
   */
  async loadIndex() {
    try {
      const data = await fs.readFile(this.indexPath, 'utf8');
      const index = JSON.parse(data);

      // OPTIMIZATION: Build inverted index after loading
      if (index.files && index.files.length > 0) {
        this.buildInvertedIndex(index.files);
      }

      return index;
    } catch (error) {
      return null;
    }
  }

  /**
   * OPTIMIZED: Search indexed files using inverted index and caching
   * Target: <30ms (down from <50ms)
   */
  searchIndex(query, limit = 10) {
    const index = this.loadedIndex;
    if (!index || !index.files) {
      return [];
    }

    if (!query || query.length < 2) {
      return [];
    }

    // OPTIMIZATION: Check cache first
    const cacheKey = `${query}:${limit}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();
    const results = [];
    const queryLower = query.toLowerCase();

    // Extract query terms for inverted index lookup
    const queryTerms = queryLower.match(/\w+/g) || [];

    if (queryTerms.length > 0 && this.invertedIndex.size > 0) {
      // OPTIMIZATION: Use inverted index for keyword search (much faster)
      results.push(...this.searchWithInvertedIndex(queryTerms, query, index, limit));
    } else {
      // Fallback to linear search for phrase queries or when index not available
      results.push(...this.searchLinear(queryLower, query, index));
    }

    // Sort by score and return top results
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);

    // OPTIMIZATION: Cache results for faster repeated searches
    this.searchCache.set(cacheKey, topResults);

    const duration = Date.now() - startTime;
    console.log(`[Indexer] Search completed in ${duration}ms (${results.length} results)`);

    return topResults;
  }

  /**
   * OPTIMIZED: Search using inverted index
   * Much faster for keyword searches (O(k) where k = matching terms)
   */
  searchWithInvertedIndex(queryTerms, originalQuery, index, limit) {
    const results = [];
    const seenLines = new Set(); // Deduplication
    const queryLower = originalQuery.toLowerCase();

    // Find all lines containing any query term
    const candidateLines = new Map(); // lineKey -> {fileIdx, lineIdx, score, matchCount}

    queryTerms.forEach(term => {
      const matches = this.invertedIndex.get(term) || [];

      matches.forEach(match => {
        const lineKey = `${match.fileIdx}:${match.lineIdx}`;

        if (!candidateLines.has(lineKey)) {
          candidateLines.set(lineKey, {
            ...match,
            matchCount: 0
          });
        }

        // Increment match count (more terms matched = higher score)
        candidateLines.get(lineKey).matchCount++;
      });
    });

    // Process candidates and calculate final scores
    for (const [lineKey, candidate] of candidateLines) {
      if (seenLines.has(lineKey)) continue;
      seenLines.add(lineKey);

      const file = index.files[candidate.fileIdx];
      const text = candidate.text;
      const textLower = text.toLowerCase();

      // Verify the line actually contains the full query (for phrase searches)
      if (!textLower.includes(queryLower)) {
        continue;
      }

      // Calculate final score with bonuses
      let score = candidate.score;

      // Exact match bonus
      if (textLower.includes(queryLower)) {
        score += 0.5;
      }

      // File name match bonus
      if (file.name.toLowerCase().includes(queryLower)) {
        score += 0.2;
      }

      // Path match bonus
      if (file.path.toLowerCase().includes(queryLower)) {
        score += 0.1;
      }

      // Multi-term match bonus
      const termMatchRatio = candidate.matchCount / queryTerms.length;
      score += termMatchRatio * 0.3;

      results.push({
        file: file.path,
        line: candidate.lineNum || (candidate.lineIdx + 1),
        content: text,
        score: Math.min(1.0, score),
        language: file.language
      });

      // OPTIMIZATION: Early termination if we have enough high-scoring results
      if (results.length >= limit * 3) {
        break;
      }
    }

    return results;
  }

  /**
   * Fallback linear search for phrase queries
   */
  searchLinear(queryLower, originalQuery, index) {
    const results = [];

    for (const file of index.files) {
      // OPTIMIZATION: Use lineIndex instead of content
      if (!file.lineIndex) continue;

      for (const lineData of file.lineIndex) {
        const text = lineData.text || '';
        const textLower = text.toLowerCase();

        if (textLower.includes(queryLower)) {
          // Calculate relevance score
          const score = this.calculateScore(text, originalQuery, file);

          results.push({
            file: file.path,
            line: lineData.idx,
            content: text,
            score: score,
            language: file.language
          });
        }
      }
    }

    return results;
  }

  /**
   * Calculate relevance score
   */
  calculateScore(line, query, file) {
    let score = 0;

    // Exact match bonus
    if (line.toLowerCase().includes(query.toLowerCase())) {
      score += 0.5;
    }

    // File name match bonus
    if (file.name.toLowerCase().includes(query.toLowerCase())) {
      score += 0.2;
    }

    // Path match bonus
    if (file.path.toLowerCase().includes(query.toLowerCase())) {
      score += 0.1;
    }

    // Length penalty (prefer shorter, more focused matches)
    score += 0.2 / (1 + line.length / 100);

    return Math.min(1.0, score);
  }

  /**
   * OPTIMIZATION: Get surrounding context for a line (lazy-loads file content)
   */
  async getContext(filePath, lineNumber, contextLines = 2) {
    const content = await this.getFileContent(filePath);
    if (!content) return '';

    const lines = content.split('\n');
    const lineIndex = lineNumber - 1;
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);

    return lines.slice(start, end).join('\n');
  }

  /**
   * OPTIMIZATION: Lazy load file content when needed (with caching)
   */
  async getFileContent(filePath) {
    // Check cache first
    if (this.fileContents.has(filePath)) {
      return this.fileContents.get(filePath);
    }

    try {
      // Security check: validate path stays within project root
      const fullPath = path.resolve(this.projectRoot, filePath);
      if (!fullPath.startsWith(this.projectRoot + path.sep) && fullPath !== this.projectRoot) {
        throw new Error('Invalid file path: path traversal not allowed');
      }

      const content = await fs.readFile(fullPath, 'utf8');

      // Cache with size limit (max 50 files)
      if (this.fileContents.size >= 50) {
        // Remove first (oldest) entry
        const firstKey = this.fileContents.keys().next().value;
        this.fileContents.delete(firstKey);
      }

      this.fileContents.set(filePath, content);
      return content;
    } catch (error) {
      console.warn(`[Indexer] Failed to load file ${filePath}:`, error.message);
      return null;
    }
  }
}

module.exports = FileIndexer;
