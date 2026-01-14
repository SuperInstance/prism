/**
 * ============================================================================
 * SEARCH COMMAND - Semantic Code Search
 * ============================================================================
 *
 * Implements the `prism search` command for querying the indexed codebase
 * using semantic similarity search.
 *
 * Purpose:
 * --------
 * Find relevant code snippets using natural language queries instead of
 * exact text matching. This enables:
 * - "Find authentication functions" → Returns auth-related code
 * - "Where is error handling?" → Returns error handling code
 * - "Database connection logic" → Returns DB connection code
 *
 * Workflow:
 * ---------
 * 1. Load configuration
 * 2. Check if index exists (error if not)
 * 3. Initialize vector database
 * 4. Generate query embedding
 * 5. Perform vector similarity search
 * 6. Rank and filter results by relevance score
 * 7. Display results with code snippets
 *
 * Usage:
 * ```bash
 * prism search "authentication"                 # Basic search
 * prism search "authentication" --limit 20      # More results
 * prism search "auth" --min-score 0.7           # Higher relevance threshold
 * prism search "login" --show-code              # Include code snippets
 * prism search "database" --format json         # JSON output
 * ```
 *
 * Options:
 * --------
 * - <query>: Search query (natural language or code terms)
 * - -l, --limit: Maximum results (default: 10)
 * - -m, --min-score: Minimum relevance 0-1 (default: 0.0)
 * - -f, --format: Output format: text|json (default: text)
 * - -v, --verbose: Show detailed information
 * - --show-code: Display code snippets
 * - --context-lines: Lines of context (default: 5)
 *
 * Output Format:
 * --------------
 * Text mode shows:
 * - Result rank and relevance score
 * - File path and line numbers
 * - Language detected
 * - Code snippet (if --show-code)
 *
 * JSON mode provides:
 * - count: Number of results
 * - results: Array of result objects with all fields
 *
 * Error Handling:
 * ---------------
 * - No index found: Suggests running 'prism index' first
 * - Index corrupted: Suggests re-indexing with --force
 * - Low results: Provides search improvement tips
 *
 * Current Limitations:
 * --------------------
 * - Vector search not implemented (returns empty results)
 * - Query embedding generation not implemented
 * - No result caching
 * - No fuzzy matching for typos
 * - No support for complex queries (AND/OR/NOT)
 *
 * @see docs/architecture/vector-search.md
 * @see src/vector-db/ - Vector database implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, expandTilde } from '../../config/loader.js';
import { createSpinner } from '../progress.js';
import { handleCLIError, createDBError } from '../errors.js';
import type { SearchResult } from '../../core/types.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Command-line options for the search command
 *
 * All options are optional with sensible defaults:
 * - limit: Control result set size
 * - min-score: Filter by relevance threshold
 * - format: Choose between human-readable or machine-readable output
 * - verbose: Show debugging information
 * - show-code: Include code snippets in output
 * - context-lines: Control snippet length
 */
interface SearchOptions {
  limit?: string;
  'min-score'?: string;
  format?: 'text' | 'json';
  verbose?: boolean;
  'show-code'?: boolean;
  'context-lines'?: string;
}

// ============================================================================
// RESULT FORMATTING
// ============================================================================

/**
 * Format a single search result for display
 *
 * Creates a formatted text representation of a search result including:
 * - Rank number and relevance score
 * - File location with line numbers
 * - Language detected
 * - Code snippet (if requested)
 *
 * @param result - The search result to format
 * @param index - Result rank (0-based)
 * @param showCode - Whether to include code snippet
 * @param contextLines - Number of lines to show around match
 * @returns Formatted string for display
 *
 * Example output:
 * ```
 * 1. src/auth.ts:25-40 (85.3% match)
 *    Language: typescript
 *    ────────────────────────────────────────────────────────────
 *    25 │ export function authenticateUser(credentials: Credentials) {
 *   26 │   const user = await database.users.findByEmail(credentials.email);
 *   27 │   if (!user) {
 *   28 │     throw new AuthenticationError('Invalid credentials');
 *   29 │   }
 *    ...
 * ```
 */
function formatResult(result: SearchResult, index: number, showCode: boolean, contextLines: number): string {
  const lines: string[] = [];

  // Header with rank and score
  const scorePercent = (result.score * 100).toFixed(1);
  lines.push(
    chalk.bold.cyan(`\n${index + 1}. `) +
      chalk.white(`${result.file}:${result.startLine}-${result.endLine}`) +
      chalk.gray(` (${scorePercent}% match)`)
  );

  // Language badge
  lines.push(chalk.gray(`   Language: ${result.language}`));

  // Code snippet
  if (showCode) {
    lines.push(chalk.gray('   ' + '─'.repeat(60)));

    const codeLines = result.text.split('\n');
    const startLine = result.startLine;

    for (let i = 0; i < Math.min(codeLines.length, contextLines); i++) {
      const lineNum = startLine + i;
      const line = codeLines[i] || '';
      lines.push(
        chalk.gray(`${lineNum.toString().padStart(4)} │ `) +
          chalk.white(line)
      );
    }

    if (codeLines.length > contextLines) {
      lines.push(chalk.gray(`     │ ... (${codeLines.length - contextLines} more lines)`));
    }
  }

  return lines.join('\n');
}

/**
 * Format search results as JSON for programmatic consumption
 *
 * Creates a machine-readable JSON output containing:
 * - count: Total number of results
 * - results: Array of result objects with all fields
 *
 * Useful for:
 * - Piping to other tools
 * - Scripting and automation
 * - Post-processing with jq or other tools
 *
 * @param results - Array of search results
 * @returns JSON string with 2-space indentation
 *
 * Example output:
 * ```json
 * {
 *   "count": 2,
 *   "results": [
 *     {
 *       "id": "abc123",
 *       "file": "/path/to/file.ts",
 *       "startLine": 25,
 *       "endLine": 40,
 *       "score": 0.853,
 *       "language": "typescript",
 *       "text": "export function authenticateUser..."
 *     }
 *   ]
 * }
 * ```
 */
function formatResultsJSON(results: SearchResult[]): string {
  return JSON.stringify(
    {
      count: results.length,
      results: results.map((r) => ({
        id: r.id,
        file: r.file,
        startLine: r.startLine,
        endLine: r.endLine,
        score: r.score,
        language: r.language,
        text: r.text,
      })),
    },
    null,
    2
  );
}

/**
 * Display search results summary
 *
 * Shows aggregate statistics about the search:
 * - Number of results found
 * - Query that was executed
 * - Time taken to search
 * - Average relevance score
 *
 * @param results - Array of search results
 * @param query - The search query string
 * @param duration - Search duration in milliseconds
 */
function displaySummary(results: SearchResult[], query: string, duration: number): void {
  console.log(chalk.gray('─'.repeat(70)));
  console.log(chalk.white(`Found ${chalk.bold.green(results.length)} result${results.length === 1 ? '' : 's'} for "${chalk.cyan(query)}"`));

  if (duration > 0) {
    console.log(chalk.gray(`Search completed in ${duration.toFixed(0)}ms`));
  }

  if (results.length > 0) {
    const avgScore = (results.reduce((sum, r) => sum + r.score, 0) / results.length * 100).toFixed(1);
    console.log(chalk.gray(`Average relevance: ${avgScore}%`));
  }

  console.log('');
}

// ============================================================================
// COMMAND REGISTRATION
// ============================================================================

/**
 * Register the search command with the CLI program
 *
 * Defines the command interface and implementation for `prism search`.
 * The command performs semantic search on the indexed codebase.
 *
 * @param program - The Commander program instance
 */
export function registerSearchCommand(program: Command): void {
  program
    .command('search')
    .description('Search indexed code using semantic search')
    .argument('<query>', 'Search query')
    .option('-l, --limit <number>', 'Maximum number of results', '10')
    .option('-m, --min-score <score>', 'Minimum relevance score (0-1)', '0.0')
    .option('-f, --format <format>', 'Output format (text|json)', 'text')
    .option('-v, --verbose', 'Show detailed information')
    .option('--show-code', 'Show code snippets in results')
    .option('--context-lines <number>', 'Number of context lines to show', '5')
    .action(async (query: string, options: SearchOptions) => {
      try {
        const spinner = createSpinner(options.verbose);
        const startTime = Date.now();

        // ======================================================================
        // STEP 1: Load Configuration
        // ======================================================================
        spinner.start('Loading configuration...');
        const config = await loadConfig();
        spinner.succeed('Configuration loaded');

        // ======================================================================
        // STEP 2: Validate Index Exists
        // ======================================================================
        // Check if the vector database file exists before attempting search
        spinner.start('Loading index...');
        const dbPath = expandTilde(config.vectorDB.path || '~/.prism/vector.db');

        // Check if index exists
        const fsModule = await import('fs-extra');
        if (!(await fsModule.pathExists(dbPath))) {
          spinner.fail('Index not found');
          console.error(chalk.red('\nNo index found at: ' + dbPath));
          console.error(chalk.yellow('\nTo create an index, run:'));
          console.error(chalk.cyan('  prism index <path>'));
          process.exit(1);
        }

        // TODO: Load actual vector database
        // const vectorDB = new MemoryVectorDB();
        // await vectorDB.load(dbPath);

        spinner.succeed('Index loaded');

        // ======================================================================
        // STEP 3: Perform Search
        // ======================================================================
        // Execute semantic search using vector similarity
        spinner.start('Searching...');
        // const limit = parseInt(options.limit || '10', 10);
        // const minScore = parseFloat(options['min-score'] || '0.0');

        let results: SearchResult[] = [];

        try {
          // TODO: Implement actual search
          // 1. Generate query embedding
          // 2. Query vector database
          // 3. Rank by similarity score
          // 4. Filter by min-score
          // 5. Limit to N results
          // results = await vectorDB.search(query, limit, minScore);

          // AUDIT: Currently returns empty results - search not implemented
          results = [];
        } catch (error) {
          spinner.fail('Search failed');
          throw createDBError(
            'Failed to search the index',
            error instanceof Error ? error.message : String(error),
            [
              'Ensure the index is not corrupted',
              'Try re-indexing with: prism index --force',
              'Check the logs for more details',
            ]
          );
        }

        spinner.succeed(`Found ${results.length} results`);

        const duration = Date.now() - startTime;

        // ======================================================================
        // STEP 4: Display Results
        // ======================================================================
        // Output results in requested format (text or JSON)
        if (options.format === 'json') {
          console.log(formatResultsJSON(results));
        } else {
          // Text mode output
          if (results.length === 0) {
            console.log(chalk.yellow('\nNo results found.\n'));
            console.log(chalk.gray('Tips for better searches:'));
            console.log(chalk.gray('  • Use specific terms related to the code'));
            console.log(chalk.gray('  • Try different variations of your query'));
            console.log(chalk.gray('  • Use function or class names'));
            console.log(chalk.gray('  • Check if the code has been indexed'));
          } else {
            const showCode = options['show-code'] || false;
            const contextLines = parseInt(options['context-lines'] || '5', 10);

            results.forEach((result, index) => {
              console.log(formatResult(result, index, showCode, contextLines));
            });

            displaySummary(results, query, duration);
          }
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
 * Register the search command with the CLI program (alias for 'find')
 */
// export function registerFindCommand(program: Command): void {
//   program
//     .command('find')
//     .alias('search')
//     .description('Search indexed code (alias for search)')
//     .argument('<query>', 'Search query')
//     .option('-l, --limit <number>', 'Maximum number of results', '10')
//     .option('-m, --min-score <score>', 'Minimum relevance score (0-1)', '0.0')
//     .option('-f, --format <format>', 'Output format (text|json)', 'text')
//     .option('-v, --verbose', 'Show detailed information')
//     .option('--show-code', 'Show code snippets in results')
//     .option('--context-lines <number>', 'Number of context lines to show', '5')
//     .action(async (query: string, options: SearchOptions) => {
//       // Reuse search command implementation
//       const searchCmd = program.commands.find((c) => c.name() === 'search');
//       if (searchCmd) {
//         await searchCmd.args[0].parse([query]);
//         await searchCmd.parseAsync([], { from: 'user' });
//       }
//     });
// }
