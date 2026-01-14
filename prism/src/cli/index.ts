#!/usr/bin/env node
/**
 * ============================================================================
 * PRISM CLI - MAIN ENTRY POINT
 * ============================================================================
 *
 * This is the main entry point for the Prism CLI tool. It initializes the
 * Commander.js program, registers all subcommands, and configures global
 * error handling.
 *
 * Architecture:
 * ------------
 * The CLI is organized into modular commands, each in its own file:
 * - index.ts    : Codebase indexing (src/cli/commands/index.ts)
 * - search.ts   : Semantic search (src/cli/commands/search.ts)
 * - chat.ts     : Interactive chat (src/cli/commands/chat.ts)
 * - stats.ts    : Usage statistics (src/cli/commands/stats.ts)
 * - init        : Project initialization (embedded below)
 * - config      : Configuration display (embedded below)
 *
 * Command Registration Flow:
 * --------------------------
 * 1. Create Commander program instance
 * 2. Configure program metadata (name, version, description)
 * 3. Add help text with usage examples
 * 4. Register all subcommands
 * 5. Add embedded commands (init, config)
 * 6. Configure global error handlers
 * 7. Parse arguments and execute
 *
 * Error Handling:
 * ---------------
 * - Uncaught exceptions: Handled by handleCLIError()
 * - Unhandled rejections: Converted to errors and handled
 * - Command-specific errors: Handled within each command
 *
 * Usage Examples:
 * ---------------
 * ```bash
 * prism index ./src              # Index the src directory
 * prism search "authentication"  # Search for authentication code
 * prism chat                      # Start interactive chat mode
 * prism stats                     # Show usage statistics
 * prism init                      # Initialize Prism configuration
 * prism config                    # Show current configuration
 * ```
 *
 * @see docs/architecture/cli-architecture.md
 * @see src/cli/commands/ - Individual command implementations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  registerIndexCommand,
} from './commands/index.js';
import {
  registerSearchCommand,
} from './commands/search.js';
import {
  registerChatCommand,
} from './commands/chat.js';
import {
  registerStatsCommand,
  registerStatusCommand,
} from './commands/stats.js';
import { handleCLIError } from './errors.js';

// ============================================================================
// PROGRAM INITIALIZATION
// ============================================================================

/**
 * Create the CLI program instance using Commander.js
 *
 * Commander provides:
 * - Argument parsing
 * - Option handling
 * - Help text generation
 * - Command registration
 * - Error handling
 */
const program = new Command();

/**
 * Configure program metadata and behavior
 *
 * Settings:
 * - name: 'prism' - The CLI command name
 * - description: Human-readable description of the tool
 * - version: Current version (follows semver)
 * - helpText: Additional examples shown after main help
 *
 * The examples section is critical for user onboarding, showing common
 * workflows at a glance.
 */
program
  .name('prism')
  .description('AI-powered codebase indexer and RAG engine for Claude Code')
  .version('0.1.0')
  .addHelpText('after', `\n${chalk.cyan('Examples:')}\n` +
    `  ${chalk.gray('$')} prism index ./src              ${chalk.gray('# Index the src directory')}\n` +
    `  ${chalk.gray('$')} prism search "authentication"  ${chalk.gray('# Search for authentication code')}\n` +
    `  ${chalk.gray('$')} prism chat                      ${chalk.gray('# Start interactive chat mode')}\n` +
    `  ${chalk.gray('$')} prism stats                     ${chalk.gray('# Show usage statistics')}\n`
  );

// ============================================================================
// COMMAND REGISTRATION
// ============================================================================

/**
 * Register all subcommands with the CLI program
 *
 * Each command is imported from its own module to maintain separation of
 * concerns and keep the codebase maintainable.
 *
 * Commands are registered in the order they should appear in help text:
 * 1. index    - Core functionality (indexing)
 * 2. search   - Core functionality (searching)
 * 3. chat     - Interactive mode
 * 4. stats    - Information display
 * 5. status   - Alias for stats
 * 6. config   - Configuration display (embedded)
 * 7. init     - First-run setup (embedded)
 */
registerIndexCommand(program);
registerSearchCommand(program);
registerChatCommand(program);
registerStatsCommand(program);
registerStatusCommand(program);

// ============================================================================
// CONFIG COMMAND - Configuration Display
// ============================================================================
/**
 * CONFIG COMMAND
 *
 * Displays the current Prism configuration in a human-readable format.
 *
 * Usage:
 * ```bash
 * prism config              # Display full configuration
 * prism config --path       # Show only config file path
 * ```
 *
 * Output Format:
 * --------------
 * The command displays configuration in sections:
 * - Config Path: Location of config.json
 * - Indexer: Chunk size, overlap, languages
 * - Vector DB: Type and storage path
 * - Token Optimizer: Max tokens and compression ratio
 * - Model Router: Local model preference and endpoint
 *
 * Error Handling:
 * ---------------
 * - Missing config: Displays error suggesting to run 'prism init'
 * - Invalid config: Shows specific validation errors
 * - Permission errors: Indicates file access issues
 *
 * @see src/config/loader.ts - Configuration loading logic
 * @see docs/user/configuration.md - Configuration reference
 */
program
  .command('config')
  .description('Show current configuration')
  .option('-p, --path', 'Show config file path')
  .action(async (options) => {
    try {
      const { getConfigFilePath, loadConfig } = await import('../config/loader.js');

      // If --path flag, show only the config file path
      // This is useful for scripts that need to locate the config file
      if (options.path) {
        console.log(getConfigFilePath());
        process.exit(0);
      }

      // Load the full configuration
      const config = await loadConfig();

      // Display configuration in formatted sections
      console.log(chalk.bold.cyan('\nPrism Configuration:'));
      console.log(chalk.gray('─'.repeat(70)));
      console.log(chalk.white(`  Config Path:  ${chalk.gray(getConfigFilePath())}`));
      console.log('');
      console.log(chalk.bold('Indexer:'));
      console.log(chalk.white(`    Chunk Size:     ${chalk.cyan(config.indexer.chunkSize)}`));
      console.log(chalk.white(`    Overlap:        ${chalk.cyan(config.indexer.overlap)}`));
      console.log(chalk.white(`    Languages:      ${chalk.cyan(config.indexer.languages.join(', '))}`));
      console.log('');
      console.log(chalk.bold('Vector DB:'));
      console.log(chalk.white(`    Type:           ${chalk.cyan(config.vectorDB.type)}`));
      console.log(chalk.white(`    Path:           ${chalk.cyan(config.vectorDB.path)}`));
      console.log('');
      console.log(chalk.bold('Token Optimizer:'));
      console.log(chalk.white(`    Max Tokens:     ${chalk.cyan(config.tokenOptimizer.maxTokens)}`));
      console.log(chalk.white(`    Compression:    ${chalk.cyan((config.tokenOptimizer.targetCompression * 100).toFixed(0) + '%')}`));
      console.log('');
      console.log(chalk.bold('Model Router:'));
      console.log(chalk.white(`    Prefer Local:   ${chalk.cyan(config.modelRouter.preferLocal)}`));
      console.log(chalk.white(`    Endpoint:       ${chalk.cyan(config.modelRouter.localEndpoint)}`));
      console.log('');

      process.exit(0);
    } catch (error) {
      handleCLIError(error instanceof Error ? error : new Error(String(error)));
    }
  });

// ============================================================================
// INIT COMMAND - Project Initialization
// ============================================================================
/**
 * INIT COMMAND
 *
 * Creates the initial Prism configuration for a new project.
 *
 * Workflow:
 * ---------
 * 1. Check if config already exists (skip if yes)
 * 2. Create ~/.prism directory if needed
 * 3. Write default config.json with sensible defaults
 * 4. Display success message with next steps
 *
 * Default Configuration:
 * ----------------------
 * - Chunk Size: 500 tokens (balances context and granularity)
 * - Overlap: 50 tokens (maintains context across chunks)
 * - Languages: TypeScript, JavaScript, Python, Rust, Go
 * - Vector DB: SQLite at ~/.prism/vector.db
 * - Max Tokens: 8000 (fits most LLM context windows)
 * - Compression: 90% (aggressive compression for token savings)
 *
 * Usage:
 * ```bash
 * prism init
 * ```
 *
 * Next Steps (shown to user):
 * ---------------------------
 * 1. Index your codebase: prism index <path>
 * 2. Search your code: prism search "<query>"
 * 3. Start chatting: prism chat
 *
 * Error Handling:
 * ---------------
 * - Permission errors: Suggest running with appropriate permissions
 * - Invalid directory: Check ~/.prism directory accessibility
 * - Config conflicts: Warn if config already exists
 *
 * @see src/config/loader.ts - Configuration defaults
 * @see docs/user/getting-started.md - Setup guide
 */
program
  .command('init')
  .description('Initialize Prism configuration')
  .action(async () => {
    try {
      const { ensureConfig, getConfigFilePath } = await import('../config/loader.js');

      console.log(chalk.cyan.bold('\nInitializing Prism...\n'));

      // Create configuration with defaults
      await ensureConfig();

      console.log(chalk.green('✓ Configuration created at:'));
      console.log(chalk.gray(`  ${getConfigFilePath()}\n`));

      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray('  1. Index your codebase: prism index <path>'));
      console.log(chalk.gray('  2. Search your code: prism search "<query>"'));
      console.log(chalk.gray('  3. Start chatting: prism chat\n'));

      process.exit(0);
    } catch (error) {
      handleCLIError(error instanceof Error ? error : new Error(String(error)));
    }
  });

// ============================================================================
// GLOBAL ERROR HANDLING
// ============================================================================

/**
 * Global error handlers for uncaught exceptions and unhandled rejections
 *
 * These handlers ensure that all errors are properly formatted and displayed
 * to the user, even if they occur outside of command-specific error handling.
 *
 * Uncaught Exceptions:
 * -------------------
 * Synchronous errors that are not caught by try/catch blocks.
 * Examples: TypeError, ReferenceError, etc.
 *
 * Unhandled Rejections:
 * ---------------------
 * Promise rejections that do not have a .catch() handler.
 * Examples: Async errors, network failures, etc.
 *
 * Both handlers use handleCLIError() to:
 * - Format the error message consistently
 * - Show stack traces in verbose mode
 * - Provide helpful recovery suggestions
 * - Exit with appropriate status code
 */
process.on('uncaughtException', (error) => {
  handleCLIError(error);
});

process.on('unhandledRejection', (reason) => {
  handleCLIError(reason instanceof Error ? reason : new Error(String(reason)));
});

// ============================================================================
// EXECUTION
// ============================================================================

/**
 * Parse command-line arguments and execute the appropriate command
 *
 * This is the final step in the CLI initialization process. Commander.js
 * will:
 * 1. Parse process.argv
 * 2. Match the command name
 * 3. Validate arguments and options
 * 4. Call the command's action handler
 * 5. Handle any errors that occur
 *
 * If no command is provided, Commander will display the help text.
 */
program.parse();
