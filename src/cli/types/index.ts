/**
 * CLI type definitions
 *
 * This module contains types for command-line interface operations,
 * including command definitions, options, and execution context.
 */

/**
 * CLI command definition
 *
 * Defines a command that can be invoked from the command line.
 */
export interface CLICommand {
  /** Command name (e.g., 'index', 'search') */
  name: string;

  /** Human-readable description */
  description: string;

  /** Function to handle command execution */
  handler: (args: CLIParsedArgs, context: CLIContext) => Promise<CLIResult>;

  /** Command options */
  options?: CLIOption[];

  /** Examples of usage */
  examples?: CLIExample[];

  /** Subcommands (if any) */
  subcommands?: CLICommand[];
}

/**
 * Parsed command-line arguments
 *
 * Contains both positional arguments and parsed flags.
 */
export interface CLIParsedArgs {
  /** Positional arguments */
  positional: string[];

  /** Flag values (key = flag name without dashes) */
  flags: Record<string, string | boolean | string[]>;

  /** Raw argv array */
  raw: string[];
}

/**
 * CLI option definition
 *
 * Defines a flag or option that can be passed to a command.
 */
export interface CLIOption {
  /** Flag name (e.g., '--output', '-o') */
  flag: string;

  /** Short flag name (e.g., '-o') */
  short?: string;

  /** Human-readable description */
  description: string;

  /** Is this option required? */
  required?: boolean;

  /** Default value if not provided */
  default?: string | boolean | string[];

  /** Expected type */
  type?: 'string' | 'boolean' | 'number' | 'array';

  /** Validation function */
  validate?: (value: unknown) => boolean | string;
}

/**
 * CLI usage example
 *
 * Provides example usage for help text.
 */
export interface CLIExample {
  /** Example command */
  command: string;

  /** Description of what this does */
  description: string;
}

/**
 * CLI execution context
 *
 * Provides context and configuration for command execution.
 */
export interface CLIContext {
  /** Current working directory */
  cwd: string;

  /** Application configuration */
  config: PrismConfig;

  /** Enable verbose output */
  verbose: boolean;

  /** CLI version */
  version: string;

  /** Environment name (development, production) */
  env: 'development' | 'production' | 'test';
}

/**
 * CLI command execution result
 *
 * Result from executing a CLI command.
 */
export interface CLIResult {
  /** Exit code (0 = success) */
  exitCode: number;

  /** Output message */
  message?: string;

  /** Data to output (for JSON mode) */
  data?: unknown;

  /** Error if command failed */
  error?: Error;
}

/**
 * CLI configuration
 *
 * Configuration specific to CLI behavior.
 */
export interface CLIConfig {
  /** Output format */
  format: 'text' | 'json' | 'markdown';

  /** Color output (if terminal supports) */
  color: boolean;

  /** Progress indicator */
  progress: boolean;

  /** Confirm destructive operations */
  confirm: boolean;
}

/**
 * Command categories for help organization
 */
export type CommandCategory =
  | 'indexing'
  | 'search'
  | 'config'
  | 'system'
  | 'utility';

/**
 * Command metadata for help display
 */
export interface CommandMetadata {
  /** Command name */
  name: string;

  /** Category */
  category: CommandCategory;

  /** Short description (one line) */
  shortDescription: string;

  /** Long description (paragraphs) */
  longDescription?: string;

  /** Usage string */
  usage: string;

  /** Is this command experimental? */
  experimental?: boolean;

  /** Is this command deprecated? */
  deprecated?: boolean;

  /** Replacement command if deprecated */
  replacement?: string;
}

/**
 * Progress reporting interface
 *
 * Used for long-running commands to show progress.
 */
export interface ProgressReporter {
  /** Start a progress operation */
  start(message: string, total?: number): void;

  /** Update progress */
  update(current: number, message?: string): void;

  /** Complete progress */
  complete(message?: string): void;

  /** Fail with error */
  fail(error: Error): void;
}

/**
 * Spinner type for progress
 */
export type SpinnerType = 'dots' | 'line' | 'bar' | 'simple';

/**
 * Table output configuration
 *
 * For displaying tabular data in CLI.
 */
export interface TableOptions {
  /** Column headers */
  headers: string[];

  /** Column widths (empty = auto) */
  columnWidths?: number[];

  /** Column alignment */
  alignments?: ('left' | 'right' | 'center')[];

  /** Maximum table width */
  maxWidth?: number;

  /** Border style */
  border?: 'basic' | 'rounded' | 'double' | 'none';
}

/**
 * Selection prompt options
 *
 * For interactive CLI prompts.
 */
export interface SelectOptions<T> {
  /** Prompt message */
  message: string;

  /** Choices to select from */
  choices: SelectChoice<T>[];

  /** Default selection (index) */
  default?: number;

  /** Allow multiple selections */
  multiple?: boolean;
}

/**
 * Single selection choice
 */
export interface SelectChoice<T = string> {
  /** Display label */
  label: string;

  /** Value to return */
  value: T;

  /** Optional description */
  description?: string;

  /** Is this choice disabled? */
  disabled?: boolean;
}

/**
 * Text input prompt options
 */
export interface InputOptions {
  /** Prompt message */
  message: string;

  /** Default value */
  default?: string;

  /** Validation function */
  validate?: (value: string) => boolean | string;

  /** Mask input (for passwords) */
  mask?: boolean;
}

/**
 * Confirmation prompt options
 */
export interface ConfirmOptions {
  /** Prompt message */
  message: string;

  /** Default value */
  default?: boolean;
}

/**
 * Logger interface for CLI output
 */
export interface CLILogger {
  /** Log info message */
  info(message: string): void;

  /** Log success message */
  success(message: string): void;

  /** Log warning message */
  warn(message: string): void;

  /** Log error message */
  error(message: string): void;

  /** Log debug message (only in verbose mode) */
  debug(message: string): void;

  /** Create a child logger with prefix */
  withPrefix(prefix: string): CLILogger;
}

/**
 * Log level
 */
export enum LogLevel {
  /** No output */
  SILENT = 0,

  /** Errors only */
  ERROR = 1,

  /** Warnings and errors */
  WARN = 2,

  /** Info, warnings, errors */
  INFO = 3,

  /** Everything including debug */
  DEBUG = 4,
}

/**
 * Import PrismConfig from config types
 * This avoids circular dependencies.
 */
export interface PrismConfig {
  /** Cloudflare configuration */
  cloudflare: {
    accountId: string;
    apiKey: string;
    vectorIndex?: string;
  };

  /** Ollama configuration */
  ollama: {
    enabled: boolean;
    url: string;
    model: string;
  };

  /** Indexing configuration */
  indexing: {
    include: string[];
    exclude: string[];
    watch: boolean;
    chunkSize: number;
  };

  /** Optimization configuration */
  optimization: {
    tokenBudget: number;
    minRelevance: number;
    maxChunks: number;
  };
}
