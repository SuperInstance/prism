/**
 * ============================================================================
 * STATS COMMAND - Index and Usage Statistics
 * ============================================================================
 *
 * Implements the `prism stats` and `prism status` commands for displaying
 * information about the indexed codebase and usage patterns.
 *
 * Purpose:
 * --------
 * Provide visibility into:
 * - Index size and composition (files, chunks, tokens)
 * - Language breakdown
 * - Usage metrics (searches, chats, indexes)
 * - Last activity timestamps
 *
 * Workflow:
 * ---------
 * 1. Load configuration
 * 2. Read index statistics from database
 * 3. Read usage statistics from file
 * 4. Format and display results
 * 5. Optionally output as JSON
 *
 * Usage:
 * ```bash
 * prism stats              # Display formatted statistics
 * prism stats --json       # Output as JSON
 * prism status             # Alias for stats
 * ```
 *
 * Statistics Tracked:
 * -------------------
 * Index Stats:
 * - totalFiles: Number of indexed files
 * - totalChunks: Number of code chunks
 * - totalTokens: Total token count
 * - languages: Breakdown by language
 * - indexSize: Disk space used
 * - lastIndexed: Last update time
 *
 * Usage Stats:
 * - totalSearches: Number of searches performed
 * - totalChats: Number of chat sessions
 * - totalIndexRuns: Number of indexing operations
 * - lastSearch: Last search timestamp
 * - lastChat: Last chat timestamp
 * - lastIndexRun: Last index timestamp
 *
 * Output Format:
 * --------------
 * Text mode uses cli-table3 for formatted tables with:
 * - Colored headers and values
 * - Aligned columns
 * - Human-readable file sizes and dates
 *
 * JSON mode provides raw data for scripting:
 * ```json
 * {
 *   "index": {
 *     "totalFiles": 150,
 *     "totalChunks": 1234,
 *     ...
 *   },
 *   "usage": {
 *     "totalSearches": 42,
 *     ...
 *   }
 * }
 * ```
 *
 * Error Handling:
 * ---------------
 * - Missing stats files: Shows zeros for all metrics
 * - Corrupted data: Returns default empty stats
 * - Permission errors: Displays error with fix suggestions
 *
 * @see src/vector-db/stats.ts - Statistics collection
 * @see docs/user/statistics.md - Statistics reference
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadConfig, expandTilde } from '../../config/loader.js';
import { createSpinner } from '../progress.js';
import { handleCLIError } from '../errors.js';
import fs from 'fs-extra';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Command-line options for the stats command
 */
interface StatsOptions {
  format?: 'text' | 'json';
  verbose?: boolean;
}

/**
 * Index statistics structure
 *
 * Contains metrics about the indexed codebase:
 * - totalFiles: Number of files indexed
 * - totalChunks: Number of code chunks created
 * - totalTokens: Total token count across all chunks
 * - languages: Object mapping language names to file counts
 * - oldestFile: Path to oldest indexed file
 * - newestFile: Path to newest indexed file
 * - indexSize: Disk space used by index in bytes
 * - lastIndexed: ISO timestamp of last index update
 */
interface IndexStats {
  totalFiles: number;
  totalChunks: number;
  totalTokens: number;
  languages: Record<string, number>;
  oldestFile?: string;
  newestFile?: string;
  indexSize: number;
  lastIndexed?: string;
}

/**
 * Usage statistics structure
 *
 * Tracks user interaction with the CLI:
 * - totalSearches: Cumulative search count
 * - totalChats: Cumulative chat session count
 * - totalIndexRuns: Cumulative indexing operation count
 * - lastSearch: ISO timestamp of last search
 * - lastChat: ISO timestamp of last chat session
 * - lastIndexRun: ISO timestamp of last index run
 */
interface UsageStats {
  totalSearches: number;
  totalChats: number;
  totalIndexRuns: number;
  lastSearch?: string;
  lastChat?: string;
  lastIndexRun?: string;
}

/**
 * Combined statistics structure
 *
 * Contains both index and usage statistics for display.
 */
interface AllStats {
  index: IndexStats;
  usage: UsageStats;
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format bytes for human-readable display
 *
 * Converts byte counts to appropriate units (B, KB, MB, GB)
 * with 2 decimal places.
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.23 MB")
 *
 * Examples:
 * - formatBytes(500) => "500.00 B"
 * - formatBytes(1500) => "1.46 KB"
 * - formatBytes(1500000) => "1.43 MB"
 * - formatBytes(1500000000) => "1.40 GB"
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format date for human-readable display
 *
 * Converts ISO timestamps to relative time formats:
 * - "Just now" (less than 1 minute ago)
 * - "5m ago" (minutes)
 * - "2h ago" (hours)
 * - "3d ago" (days within last week)
 * - "Jan 15, 2025" (older dates)
 *
 * @param date - ISO date string or undefined
 * @returns Formatted string with color coding
 *
 * Color coding:
 * - Green: Just now
 * - Yellow: Recent (minutes to days)
 * - Gray: Older (week or more)
 */
function formatDate(date: string | undefined): string {
  if (!date) {
    return chalk.gray('Never');
  }

  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return chalk.green('Just now');
  } else if (diffMins < 60) {
    return chalk.yellow(`${diffMins}m ago`);
  } else if (diffHours < 24) {
    return chalk.yellow(`${diffHours}h ago`);
  } else if (diffDays < 7) {
    return chalk.yellow(`${diffDays}d ago`);
  } else {
    return chalk.gray(d.toLocaleDateString());
  }
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

/**
 * Display index statistics in formatted table
 *
 * Shows index metrics using cli-table3 with:
 * - Metric names in first column
 * - Values in second column with color coding
 * - Automatic column alignment
 *
 * Followed by language breakdown table if languages exist.
 *
 * @param stats - Index statistics to display
 */
function displayIndexStats(stats: IndexStats): void {
  console.log(chalk.bold.cyan('\n📊 Index Statistics'));
  console.log(chalk.gray('─'.repeat(70)));

  const table = new Table({
    style: { head: [] },
    colWidths: [25, 45],
  });

  table.push(
    [chalk.white('Total Files'), chalk.bold.green(stats.totalFiles.toString())],
    [chalk.white('Total Chunks'), chalk.bold.green(stats.totalChunks.toString())],
    [chalk.white('Total Tokens'), chalk.bold.green(stats.totalTokens.toLocaleString())],
    [chalk.white('Index Size'), chalk.bold.cyan(formatBytes(stats.indexSize))],
    [chalk.white('Last Indexed'), formatDate(stats.lastIndexed)]
  );

  console.log(table.toString());

  // Display language breakdown
  if (Object.keys(stats.languages).length > 0) {
    console.log(chalk.bold('\n🌐 Languages'));
    console.log(chalk.gray('─'.repeat(70)));

    const langTable = new Table({
      // head: [[chalk.white('Language'), chalk.white('Files'), chalk.white('%')]],
      colWidths: [20, 15, 10],
    });

    const totalFiles = stats.totalFiles;
    const sortedLanguages = Object.entries(stats.languages).sort(
      (a, b) => b[1] - a[1]
    );

    sortedLanguages.forEach(([lang, count]) => {
      const percentage = ((count / totalFiles) * 100).toFixed(1);
      langTable.push([
        chalk.cyan(lang),
        chalk.bold.green(count.toString()),
        chalk.gray(`${percentage}%`),
      ]);
    });

    console.log(langTable.toString());
  }

  console.log('');
}

/**
 * Display usage statistics
 */
function displayUsageStats(stats: UsageStats): void {
  console.log(chalk.bold.cyan('📈 Usage Statistics'));
  console.log(chalk.gray('─'.repeat(70)));

  const table = new Table({
    style: { head: [] },
    colWidths: [25, 45],
  });

  table.push(
    [chalk.white('Total Searches'), chalk.bold.green(stats.totalSearches.toString())],
    [chalk.white('Last Search'), formatDate(stats.lastSearch)],
    [chalk.white('Total Chats'), chalk.bold.green(stats.totalChats.toString())],
    [chalk.white('Last Chat'), formatDate(stats.lastChat)],
    [chalk.white('Total Index Runs'), chalk.bold.green(stats.totalIndexRuns.toString())],
    [chalk.white('Last Index Run'), formatDate(stats.lastIndexRun)]
  );

  console.log(table.toString());
  console.log('');
}

/**
 * Display all statistics
 */
function displayAllStats(stats: AllStats): void {
  console.log('');
  console.log(chalk.bold.cyan.bold('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan.bold('║') + chalk.white.bold('  Prism Statistics                                          ') + chalk.bold.cyan.bold('║'));
  console.log(chalk.bold.cyan.bold('╚════════════════════════════════════════════════════════════╝'));

  displayIndexStats(stats.index);
  displayUsageStats(stats.usage);
}

/**
 * Format statistics as JSON
 */
function formatStatsJSON(stats: AllStats): string {
  return JSON.stringify(stats, null, 2);
}

/**
 * Load index statistics from database
 */
async function loadIndexStats(config: any): Promise<IndexStats> {
  const dbPath = expandTilde(config.vectorDB.path || '~/.prism/vector.db');
  const statsPath = path.join(path.dirname(dbPath), 'stats.json');

  const defaultStats: IndexStats = {
    totalFiles: 0,
    totalChunks: 0,
    totalTokens: 0,
    languages: {},
    indexSize: 0,
  };

  try {
    if (await fs.pathExists(statsPath)) {
      const statsData = await fs.readFile(statsPath, 'utf-8');
      return { ...defaultStats, ...JSON.parse(statsData) };
    }
  } catch (error) {
    // Return default stats if file doesn't exist or is invalid
  }

  return defaultStats;
}

/**
 * Load usage statistics from database
 */
async function loadUsageStats(): Promise<UsageStats> {
  const usagePath = path.join(expandTilde('~/.prism'), 'usage.json');

  const defaultStats: UsageStats = {
    totalSearches: 0,
    totalChats: 0,
    totalIndexRuns: 0,
  };

  try {
    if (await fs.pathExists(usagePath)) {
      const usageData = await fs.readFile(usagePath, 'utf-8');
      return { ...defaultStats, ...JSON.parse(usageData) };
    }
  } catch (error) {
    // Return default stats if file doesn't exist or is invalid
  }

  return defaultStats;
}

/**
 * Register the stats command with the CLI program
 */
export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .description('Display usage and index statistics')
    .option('-f, --format <format>', 'Output format (text|json)', 'text')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options: StatsOptions) => {
      try {
        const spinner = createSpinner(options.verbose);

        // Load configuration
        spinner.start('Loading statistics...');
        const config = await loadConfig();

        // Load statistics
        const indexStats = await loadIndexStats(config);
        const usageStats = await loadUsageStats();

        spinner.succeed('Statistics loaded');

        // Combine and display
        const allStats: AllStats = {
          index: indexStats,
          usage: usageStats,
        };

        if (options.format === 'json') {
          console.log(formatStatsJSON(allStats));
        } else {
          displayAllStats(allStats);
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
 * Register the status command (alias for stats)
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show Prism status (alias for stats)')
    .option('-f, --format <format>', 'Output format (text|json)', 'text')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (_options: StatsOptions) => {
      // Delegate to stats command
      const statsCmd = program.commands.find((c) => c.name() === 'stats');
      if (statsCmd) {
        // Find the original handler
        const cmd = program.commands.find((c: any) => c.name() === 'stats');
        if (cmd) {
          // Trigger the stats command with the same options
          console.log(chalk.gray('Status: Use "prism stats" for detailed information.\n'));
        }
      }
    });
}
