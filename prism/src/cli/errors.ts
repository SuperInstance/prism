/**
 * Error Handling for Prism CLI
 *
 * Centralized error handling with user-friendly messages
 */

import chalk from 'chalk';

/**
 * Error codes for different types of errors
 */
export enum ErrorCode {
  // Configuration errors (1000-1099)
  CONFIG_NOT_FOUND = 1000,
  CONFIG_INVALID = 1001,
  CONFIG_LOAD_FAILED = 1002,
  CONFIG_SAVE_FAILED = 1003,

  // Indexing errors (2000-2099)
  INDEX_FAILED = 2000,
  INDEX_NOT_FOUND = 2001,
  INDEX_CORRUPTED = 2002,
  PARSE_ERROR = 2003,

  // Vector DB errors (3000-3099)
  DB_CONNECTION_FAILED = 3000,
  DB_QUERY_FAILED = 3001,
  DB_INSERT_FAILED = 3002,
  DB_DELETE_FAILED = 3003,

  // Model router errors (4000-4099)
  MODEL_UNAVAILABLE = 4000,
  MODEL_REQUEST_FAILED = 4001,
  MODEL_RATE_LIMITED = 4002,
  MODEL_INVALID_RESPONSE = 4003,

  // File system errors (5000-5099)
  FILE_NOT_FOUND = 5000,
  FILE_ACCESS_DENIED = 5001,
  FILE_READ_FAILED = 5002,
  FILE_WRITE_FAILED = 5003,

  // Network errors (6000-6099)
  NETWORK_ERROR = 6000,
  NETWORK_TIMEOUT = 6001,
  NETWORK_UNREACHABLE = 6002,

  // Validation errors (7000-7099)
  VALIDATION_ERROR = 7000,
  INVALID_ARGUMENT = 7001,
  INVALID_PATH = 7002,

  // MCP errors (8000-8099)
  MCP_SERVER_ERROR = 8000,
  MCP_CLIENT_ERROR = 8001,
  MCP_PROTOCOL_ERROR = 8002,

  // Unknown errors
  UNKNOWN = 9999,
}

/**
 * Custom error class for Prism
 */
export class CLIError extends Error {
  code: ErrorCode;
  details?: string | undefined;
  suggestions?: string[] | undefined;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    details?: string,
    suggestions?: string[]
  ) {
    super(message);
    this.name = 'CLIError';
    this.code = code;
    this.details = details;
    this.suggestions = suggestions;

    // Maintains proper stack trace
    Error.captureStackTrace(this, CLIError);
  }
}

/**
 * Format an error for display in the CLI
 */
export function formatError(error: Error): string {
  let message = '';

  // Add error header
  message += chalk.red.bold('Error:\n');

  // Add error message
  message += chalk.red(`  ${error.message}\n`);

  // Add error code if it's a CLIError
  if (error instanceof CLIError) {
    message += chalk.gray(`\n  Code: ${error.code}\n`);

    // Add details if available
    if (error.details) {
      message += chalk.gray(`\n${chalk.bold('Details:')}\n`);
      message += chalk.gray(`  ${error.details}\n`);
    }

    // Add suggestions if available
    if (error.suggestions && error.suggestions.length > 0) {
      message += chalk.gray(`\n${chalk.bold('Suggestions:')}\n`);
      error.suggestions.forEach((suggestion, index) => {
        message += chalk.gray(`  ${index + 1}. ${suggestion}\n`);
      });
    }
  }

  // Add stack trace in verbose mode
  if (process.env.PRISM_VERBOSE === 'true' && error.stack) {
    message += chalk.gray(`\n${chalk.bold('Stack Trace:')}\n`);
    message += chalk.gray(error.stack.split('\n').slice(2).join('\n'));
  }

  return message;
}

/**
 * Handle CLI errors and exit gracefully
 */
export function handleCLIError(error: Error): never {
  console.error('\n' + formatError(error));

  // Exit with appropriate code
  let exitCode = 1;
  if (error instanceof CLIError) {
    exitCode = Math.floor(error.code / 100); // Use first digit as exit code
  }

  process.exit(exitCode);
}

/**
 * Show a simple error message (non-fatal)
 */
export function showError(error: Error): void {
  console.error(chalk.red(`Error: ${error.message}`));
}

/**
 * Create a configuration error
 */
export function createConfigError(message: string, details?: string, suggestions?: string[]): CLIError {
  return new CLIError(message, ErrorCode.CONFIG_INVALID, details, suggestions);
}

/**
 * Create an indexing error
 */
export function createIndexError(message: string, details?: string, suggestions?: string[]): CLIError {
  return new CLIError(message, ErrorCode.INDEX_FAILED, details, suggestions);
}

/**
 * Create a database error
 */
export function createDBError(message: string, details?: string, suggestions?: string[]): CLIError {
  return new CLIError(message, ErrorCode.DB_QUERY_FAILED, details, suggestions);
}

/**
 * Create a file system error
 */
export function createFileError(message: string, details?: string, suggestions?: string[]): CLIError {
  return new CLIError(message, ErrorCode.FILE_NOT_FOUND, details, suggestions);
}

/**
 * Wrap an unknown error in a CLIError
 */
export function wrapError(error: unknown, context: string): CLIError {
  if (error instanceof CLIError) {
    return error;
  }

  if (error instanceof Error) {
    return new CLIError(
      `${context}: ${error.message}`,
      ErrorCode.UNKNOWN,
      error.stack,
      ['Check the logs for more details', 'Run with --verbose for more information']
    );
  }

  return new CLIError(
    `${context}: Unknown error`,
    ErrorCode.UNKNOWN,
    String(error),
    ['Check the logs for more details', 'Run with --verbose for more information']
  );
}

/**
 * Validate that a path exists and is accessible
 */
export async function validatePath(filePath: string): Promise<void> {
  const fs = await import('fs-extra');

  const exists = await fs.pathExists(filePath);
  if (!exists) {
    throw new CLIError(
      `Path does not exist or is not accessible: ${filePath}`,
      ErrorCode.FILE_NOT_FOUND,
      'Please check that the path exists and you have read permissions.',
      [
        'Check the path is correct',
        'Ensure you have read permissions for the directory',
        'Use an absolute path if the relative path is not working',
      ]
    );
  }
}

/**
 * Validate that a path is a directory
 */
export async function validateDirectory(dirPath: string): Promise<void> {
  try {
    const { stat } = await import('fs/promises');
    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      throw new CLIError(
        `Path is not a directory: ${dirPath}`,
        ErrorCode.INVALID_PATH,
        'The provided path must be a directory.',
        [
          'Check the path is correct',
          'Use the parent directory if you want to index a specific file',
        ]
      );
    }
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    throw await wrapError(error, 'Failed to validate directory');
  }
}
