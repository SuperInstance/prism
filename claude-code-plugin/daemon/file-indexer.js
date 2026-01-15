const fs = require('fs').promises;
const path = require('path');

class FileIndexer {
  constructor(projectRoot, indexDir) {
    this.projectRoot = projectRoot;
    this.indexDir = indexDir;
    this.indexPath = path.join(indexDir, 'index.json');
    this.loadedIndex = null;

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
    const index = {
      version: '1.0',
      indexed_at: new Date().toISOString(),
      project_root: this.projectRoot,
      file_count: files.length,
      files: files
    };

    await this.saveIndex(index);
    console.log(`[Indexer] Indexed ${files.length} files`);
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

            files.push({
              path: relativePath,
              name: entry.name,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              lines: content.split('\n').length,
              content: content,
              extension: path.extname(entry.name),
              language: this.detectLanguage(entry.name)
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
   * Save index to disk
   */
  async saveIndex(index) {
    await fs.mkdir(this.indexDir, { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Load index from disk
   */
  async loadIndex() {
    try {
      const data = await fs.readFile(this.indexPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Search indexed files
   */
  searchIndex(query, limit = 10) {
    const index = this.loadedIndex;
    if (!index || !index.files) {
      return [];
    }

    if (!query || query.length < 2) {
      return [];
    }

    const results = [];
    const queryLower = query.toLowerCase();

    for (const file of index.files) {
      const content = file.content || '';
      const contentLower = content.toLowerCase();

      // Find all matches
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineLower = line.toLowerCase();

        if (lineLower.includes(queryLower)) {
          // Calculate relevance score
          const score = this.calculateScore(line, query, file);

          results.push({
            file: file.path,
            line: i + 1,
            content: line.trim(),
            score: score,
            language: file.language,
            context: this.getContext(lines, i)
          });
        }
      }
    }

    // Sort by score and return top results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
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
   * Get surrounding context for a line
   */
  getContext(lines, lineIndex, contextLines = 2) {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    return lines.slice(start, end).join('\n');
  }
}

module.exports = FileIndexer;
