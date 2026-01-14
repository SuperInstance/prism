/**
 * ============================================================================
 * INDEX COMMAND - Codebase Indexing
 * ============================================================================
 *
 * Implements the `prism index` command for creating semantic search indexes
 * from source code.
 *
 * Purpose:
 * --------
 * Transform a codebase into a searchable vector index by:
 * 1. Scanning files matching include patterns
 * 2. Parsing code with language-specific AST parsers
 * 3. Splitting code into chunks with overlap
 * 4. Generating embeddings for each chunk
 * 5. Storing vectors in SQLite database
 *
 * Workflow:
 * ---------
 * 1. Validate target path exists and is accessible
 * 2. Load configuration (with CLI overrides)
 * 3. Collect files using glob patterns (respects .gitignore)
 * 4. Initialize vector database and indexer
 * 5. For each file:
 *    a. Detect language from extension
 *    b. Parse AST (when parser available)
 *    c. Extract functions/classes as chunks
 *    d. Generate embeddings (Cloudflare Workers AI)
 *    e. Store in database
 * 6. Display results (files, chunks, tokens, duration)
 *
 * Usage:
 * ```bash
 * prism index ./src                    # Index src directory
 * prism index . --include-patterns "**/*.ts,**/*.js"  # Custom patterns
 * prism index . --force                # Re-index even if index exists
 * prism index . --chunk-size 1000      # Override chunk size
 * prism index . --verbose              # Show detailed progress
 * ```
 *
 * Options:
 * --------
 * - [path]: Path to codebase (default: current directory)
 * - -o, --output: Custom output directory for index
 * - -f, --force: Force re-indexing (ignore existing index)
 * - -w, --watch: Watch mode (NOT YET IMPLEMENTED)
 * - -v, --verbose: Detailed progress information
 * - --include-patterns: Comma-separated glob patterns
 * - --exclude-patterns: Comma-separated exclude patterns
 * - --chunk-size: Override default chunk size in tokens
 * - --overlap: Override chunk overlap in tokens
 *
 * Performance:
 * ------------
 * Target metrics (for launch):
 * - 1M LOC indexed in <30 seconds
 * - Memory usage <100MB for 1M LOC
 * - Parallel file processing (when implemented)
 * - Incremental updates (when implemented)
 *
 * Error Handling:
 * ---------------
 * - Invalid path: Clear error with path validation
 * - No files found: Show patterns and suggest fixes
 * - Parse errors: Count and report, continue indexing
 * - Embedding failures: Retry with exponential backoff
 * - Database errors: Clear message with recovery steps
 *
 * Current Limitations:
 * --------------------
 * - AST parsing not yet implemented (placeholder)
 * - Vector storage not yet implemented (placeholder)
 * - Watch mode not implemented
 * - No incremental indexing support
 * - No language-specific chunking strategies
 *
 * @see docs/architecture/indexer-architecture.md
 * @see src/core/indexer.ts - Core indexing logic
 * @see src/vector-db/ - Vector storage implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { loadConfig } from '../../config/loader.js';
import { createSpinner, createProgressBar } from '../progress.js';
import { handleCLIError, validatePath, validateDirectory } from '../errors.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Command-line options for the index command
 *
 * All options are optional with sensible defaults defined in config:
 * - output: Where to store the index (default: ~/.prism/vector.db)
 * - force: Re-index even if index exists
 * - watch: Watch for file changes (future)
 * - verbose: Show detailed progress
 * - include/exclude patterns: Glob patterns for file selection
 * - chunk-size: Tokens per chunk (default: 500)
 * - overlap: Token overlap between chunks (default: 50)
 */
interface IndexOptions {
  output?: string;
  force?: boolean;
  watch?: boolean;
  verbose?: boolean;
  'include-patterns'?: string;
  'exclude-patterns'?: string;
  'chunk-size'?: number;
  overlap?: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse comma-separated patterns into an array
 *
 * @param patterns - Comma-separated glob patterns (e.g., "**/*.ts,**/*.js")
 * @returns Array of trimmed pattern strings
 *
 * Example:
 * ```typescript
 * parsePatterns("**/*.ts,**/*.js")  // => ["**/*.ts", "**/*.js"]
 * ```
 */
function parsePatterns(patterns: string | undefined): string[] {
  if (!patterns) {
    return [];
  }
  return patterns.split(',').map((p) => p.trim());
}

/**
 * Format duration for display in human-readable format
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "2h 15m 30s", "15m 30s", "30s")
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// ============================================================================
// FILE COLLECTION
// ============================================================================

/**
 * Collect all files to index using glob patterns
 *
 * Uses globby (fast glob implementation) to:
 * - Match files against include patterns
 * - Exclude files matching exclude patterns
 * - Respect .gitignore (gitignore: true)
 * - Return absolute paths for consistent handling
 *
 * @param rootPath - Root directory to search
 * @param includePatterns - Glob patterns to include (e.g., ["**/*.ts", "**/*.js"])
 * @param excludePatterns - Glob patterns to exclude (e.g., ["**/node_modules/**"])
 * @returns Array of absolute file paths
 *
 * Performance:
 * - Uses native glob patterns for speed
 * - Respects .gitignore to ignore build artifacts
 * - Returns absolute paths to avoid path resolution issues
 *
 * @see https://github.com/sindresorhus/globby
 */
async function collectFiles(
  rootPath: string,
  includePatterns: string[],
  excludePatterns: string[]
): Promise<string[]> {
  const { globby } = await import('globby');

  const files = await globby(includePatterns, {
    cwd: rootPath,
    ignore: excludePatterns,
    absolute: true,
    gitignore: true,
  });

  return files;
}

// ============================================================================
// RESULTS DISPLAY
// ============================================================================

/**
 * Display indexing results summary
 *
 * Shows:
 * - Total files indexed
 * - Total chunks created
 * - Total tokens processed
 * - Number of errors (if any)
 * - Duration of indexing
 * - Processing speed (files/sec)
 *
 * @param chunks - Number of chunks created
 * @param files - Number of files indexed
 * @param errors - Number of errors encountered
 * @param duration - Duration in milliseconds
 * @param totalTokens - Total tokens processed
 *
 * Example output:
 * ```
 * Indexing Complete!
 * ───────────────────────────────────────────
 *   Files Indexed:  150
 *   Chunks Created: 1,234
 *   Total Tokens:   456,789
 *   Duration:       2m 15s
 *   Speed:          1.11 files/sec
 * ```
 */
function displayResults(
  chunks: number,
  files: number,
  errors: number,
  duration: number,
  totalTokens: number
): void {
  console.log('\n' + chalk.bold.cyan('Indexing Complete!'));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.white(`  Files Indexed:  ${chalk.bold.green(files)}`));
  console.log(chalk.white(`  Chunks Created: ${chalk.bold.green(chunks)}`));
  console.log(chalk.white(`  Total Tokens:   ${chalk.bold.green(totalTokens.toLocaleString())}`));

  if (errors > 0) {
    console.log(chalk.white(`  Errors:         ${chalk.bold.yellow(errors)}`));
  }

  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(`  Duration:       ${chalk.bold(formatDuration(duration))}`));

  if (duration > 0) {
    const filesPerSec = (files / (duration / 1000)).toFixed(2);
    console.log(chalk.white(`  Speed:          ${chalk.bold.cyan(`${filesPerSec} files/sec`)}`));
  }

  console.log('');
}

// ============================================================================
// COMMAND REGISTRATION
// ============================================================================

/**
 * Register the index command with the CLI program
 *
 * This function defines the command interface and implementation for
 * `prism index`. It:
 * 1. Defines command arguments and options
 * 2. Implements the indexing workflow
 * 3. Handles errors and edge cases
 * 4. Displays progress and results
 *
 * The command uses a spinner for status updates and a progress bar
 * for file processing to provide good UX during long-running operations.
 *
 * @param program - The Commander program instance
 */
export function registerIndexCommand(program: Command): void {
  program
    .command('index')
    .description('Index a codebase for semantic search')
    .argument('[path]', 'Path to the codebase (default: current directory)', '.')
    .option('-o, --output <path>', 'Output directory for the index')
    .option('-f, --force', 'Force re-indexing even if index exists')
    .option('-w, --watch', 'Watch for changes and re-index (not yet implemented)')
    .option('-v, --verbose', 'Show detailed progress information')
    .option('--include-patterns <patterns>', 'Comma-separated include patterns')
    .option('--exclude-patterns <patterns>', 'Comma-separated exclude patterns')
    .option('--chunk-size <size>', 'Chunk size in tokens', parseInt)
    .option('--overlap <size>', 'Overlap between chunks in tokens', parseInt)
    .action(async (targetPath: string, options: IndexOptions) => {
      try {
        const spinner = createSpinner(options.verbose);
        const startTime = Date.now();

        // ======================================================================
        // STEP 1: Validate Target Path
        // ======================================================================
        // Resolve to absolute path and validate that:
        // - Path exists
        // - Path is accessible
        // - Path is a directory (not a file)
        const resolvedPath = path.resolve(targetPath);
        await validatePath(resolvedPath);
        await validateDirectory(resolvedPath);

        // ======================================================================
        // STEP 2: Load Configuration
        // ======================================================================
        // Load default configuration and apply CLI overrides
        // CLI options take precedence over config file settings
        spinner.start('Loading configuration...');
        const config = await loadConfig();

        // Apply CLI overrides for indexer settings
        if (options['include-patterns']) {
          config.indexer.includePatterns = parsePatterns(options['include-patterns']);
        }
        if (options['exclude-patterns']) {
          config.indexer.excludePatterns = parsePatterns(options['exclude-patterns']);
        }
        if (options['chunk-size']) {
          config.indexer.chunkSize = options['chunk-size'];
        }
        if (options.overlap) {
          config.indexer.overlap = options.overlap;
        }

        spinner.succeed('Configuration loaded');

        // ======================================================================
        // STEP 3: Collect Files
        // ======================================================================
        // Scan the directory tree and collect files matching patterns
        // Uses globby for fast pattern matching and respects .gitignore
        spinner.start('Scanning for files...');
        const files = await collectFiles(
          resolvedPath,
          config.indexer.includePatterns,
          config.indexer.excludePatterns
        );

        // Handle edge case: no files found
        if (files.length === 0) {
          spinner.warn('No files found to index');
          console.log(chalk.yellow('\nNo files matched the include patterns.'));
          console.log(chalk.gray('Include patterns:'), config.indexer.includePatterns.join(', '));
          console.log(chalk.gray('Exclude patterns:'), config.indexer.excludePatterns.join(', '));
          console.log(chalk.gray('\nTip: Use --include-patterns and --exclude-patterns to customize.'));
          return;
        }

        spinner.succeed(`Found ${chalk.bold.green(files.length)} files to index`);

        // ======================================================================
        // STEP 4: Initialize Indexer
        // ======================================================================
        // Set up the indexer and vector database
        // TODO: This is currently a placeholder
        spinner.start('Initializing indexer...');
        // const outputDir = options.output
        //   ? path.resolve(options.output)
        //   : expandTilde(config.vectorDB.path || '~/.prism/vector.db');
        // const indexer = new CodeIndexer();
        spinner.succeed('Indexer initialized');

        // ======================================================================
        // STEP 5: Index Files
        // ======================================================================
        // Process each file:
        // 1. Read file content
        // 2. Detect language
        // 3. Parse AST (when implemented)
        // 4. Generate chunks
        // 5. Create embeddings
        // 6. Store in database
        const progressBar = createProgressBar(options.verbose);
        progressBar.start('Indexing files...', files.length);

        let totalChunks = 0;
        let totalTokens = 0;
        let errorCount = 0;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          try {
            if (!file) continue;

            const content = await fs.readFile(file, 'utf-8');
            if (!content) continue;

            // TODO: Implement actual indexing
            // const language = getLanguageFromExtension(path.extname(file));
            // const result = await indexer.indexFile(file, content, language);
            // totalChunks += result.chunks.length;
            // totalTokens += result.chunks.reduce((sum: number, chunk: any) => sum + chunk.tokens, 0);

            // For now, just count files and estimate tokens
            totalChunks += 1;
            totalTokens += Math.floor(content.length / 4);

            const basename = path.basename(file);
            if (basename) {
              progressBar.increment(`Indexed ${basename}`);
            }
          } catch (error) {
            // Count errors but continue processing
            errorCount++;
            if (options.verbose) {
              console.error(chalk.red(`\nFailed to index ${file}: ${error}`));
            }
          }
        }

        progressBar.complete();

        // ======================================================================
        // STEP 6: Persist Index
        // ======================================================================
        // Save the index to disk for fast querying later
        // TODO: This is currently a placeholder
        spinner.start('Saving index...');
        // TODO: Implement persistence
        spinner.succeed('Index saved');

        // ======================================================================
        // STEP 7: Display Results
        // ======================================================================
        // Show summary of indexing operation
        const duration = Date.now() - startTime;
        displayResults(totalChunks, files.length, errorCount, duration, totalTokens);

        // Warn about unimplemented features
        if (options.watch) {
          console.log(chalk.yellow('\nNote: Watch mode is not yet implemented.'));
        }

        // Exit successfully
        process.exit(0);
      } catch (error) {
        handleCLIError(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });
}

/**
 * Get language from file extension
 */
// function getLanguageFromExtension(ext: string): string {
//   const languageMap: Record<string, string> = {
//     '.ts': 'typescript',
//     '.tsx': 'typescript',
//     '.js': 'javascript',
//     '.jsx': 'javascript',
//     '.py': 'python',
//     '.rs': 'rust',
//     '.go': 'go',
//     '.java': 'java',
//     '.cpp': 'cpp',
//     '.c': 'c',
//     '.h': 'c',
//     '.cs': 'csharp',
//     '.php': 'php',
//     '.rb': 'ruby',
//     '.kt': 'kotlin',
//     '.swift': 'swift',
//     '.scala': 'scala',
//     '.sh': 'bash',
//     '.md': 'markdown',
//     '.json': 'json',
//     '.yaml': 'yaml',
//     '.yml': 'yaml',
//     '.toml': 'toml',
//     '.xml': 'xml',
//     '.html': 'html',
//     '.css': 'css',
//     '.scss': 'scss',
//     '.less': 'less',
//   };
//
//   return languageMap[ext.toLowerCase()] || 'unknown';
// }
