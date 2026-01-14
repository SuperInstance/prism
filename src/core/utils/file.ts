/**
 * File system utilities
 *
 * Provides helper functions for working with files and directories,
 * including file type detection and language identification.
 *
 * Note: This is a compatibility layer. In Cloudflare Workers environment,
 * file operations are handled differently. This implementation uses
 * Web APIs when available.
 */

import { createPrismError, ErrorCode } from '../types/index.js';

/**
 * Language extensions mapping
 *
 * Maps file extensions to language identifiers.
 */
const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',

  // Python
  '.py': 'python',
  '.pyi': 'python',

  // Rust
  '.rs': 'rust',

  // Go
  '.go': 'go',

  // Web
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',

  // Other
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.sh': 'shell',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.xml': 'xml',
  '.sql': 'sql',
};

/**
 * Source file extensions
 *
 * Extensions that should be considered as source code.
 */
const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.py',
  '.pyi',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.php',
  '.rb',
  '.swift',
  '.kt',
  '.scala',
  '.sh',
]);

/**
 * Read file contents
 *
 * @param filePath - Absolute path to file
 * @returns File contents as string
 * @throws {PrismError} If file doesn't exist or can't be read
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    // Use Web API fetch for Cloudflare Workers environment
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof Error) {
      throw createPrismError(
        ErrorCode.FILE_NOT_FOUND,
        `Failed to read file: ${filePath}`,
        { originalError: error.message }
      );
    }
    throw error;
  }
}

/**
 * Check if a file is a source code file
 *
 * @param filePath - Path to file
 * @returns True if file has a source code extension
 */
export function isSourceFile(filePath: string): boolean {
  const ext = getExtension(filePath);
  return SOURCE_EXTENSIONS.has(ext);
}

/**
 * Get programming language from file path
 *
 * @param filePath - Path to file
 * @returns Language identifier or 'unknown'
 */
export function getLanguage(filePath: string): string {
  const ext = getExtension(filePath);
  return LANGUAGE_MAP[ext] || 'unknown';
}

/**
 * Get file extension from path
 *
 * @param filePath - Path to file
 * @returns File extension including dot (e.g., '.ts')
 */
export function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = filePath.lastIndexOf('/');

  // Ensure dot is after last slash (handles files like "path/to.dir/file")
  if (lastDot === -1 || lastDot < lastSlash) {
    return '';
  }

  return filePath.slice(lastDot);
}

/**
 * Get file name from path
 *
 * @param filePath - Path to file
 * @returns File name without extension
 */
export function getFileName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  const lastDot = filePath.lastIndexOf('.');

  const start = lastSlash === -1 ? 0 : lastSlash + 1;
  const end = lastDot === -1 || lastDot < start ? filePath.length : lastDot;

  return filePath.slice(start, end);
}

/**
 * Get directory from file path
 *
 * @param filePath - Path to file
 * @returns Directory path
 */
export function getDirectory(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) {
    return '.';
  }
  return filePath.slice(0, lastSlash);
}

/**
 * Join path segments
 *
 * Simple path joining (not a full replacement for path.join).
 *
 * @param segments - Path segments to join
 * @returns Joined path
 */
export function joinPath(...segments: string[]): string {
  return segments
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

/**
 * Normalize file path
 *
 * Converts backslashes to forward slashes and removes redundant separators.
 *
 * @param filePath - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Check if path is absolute
 *
 * @param filePath - Path to check
 * @returns True if path is absolute
 */
export function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith('/');
}

/**
 * Make path absolute
 *
 * If path is relative, prepends current working directory.
 *
 * @param filePath - Path to make absolute
 * @param cwd - Current working directory
 * @returns Absolute path
 */
export function makeAbsolute(filePath: string, cwd: string): string {
  if (isAbsolutePath(filePath)) {
    return normalizePath(filePath);
  }
  return joinPath(cwd, filePath);
}

/**
 * Calculate relative path between two paths
 *
 * @param from - Source path
 * @param to - Target path
 * @returns Relative path from 'from' to 'to'
 */
export function relativePath(from: string, to: string): string {
  const fromParts = from.split('/').filter(Boolean);
  const toParts = to.split('/').filter(Boolean);

  // Find common prefix
  let commonLength = 0;
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const downParts = toParts.slice(commonLength);

  const upSegments = Array(upCount).fill('..');
  const result = [...upSegments, ...downParts].join('/');

  return result || '.';
}

/**
 * Check if file path matches a glob pattern
 *
 * Supports * and ** wildcards.
 *
 * @param filePath - File path to check
 * @param pattern - Glob pattern
 * @returns True if path matches pattern
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*\*/g, '.*') // ** matches anything
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/\?/g, '[^/]'); // ? matches single character

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(filePath);
}

/**
 * Check if file path matches any pattern
 *
 * @param filePath - File path to check
 * @param patterns - Array of glob patterns
 * @returns True if path matches any pattern
 */
export function matchesAnyPattern(
  filePath: string,
  patterns: string[]
): boolean {
  return patterns.some((pattern) => matchesGlob(filePath, pattern));
}

/**
 * Filter file paths by patterns
 *
 * @param filePaths - Array of file paths
 * @param include - Include patterns (empty = all)
 * @param exclude - Exclude patterns
 * @returns Filtered file paths
 */
export function filterByPatterns(
  filePaths: string[],
  include: string[],
  exclude: string[]
): string[] {
  return filePaths.filter((path) => {
    // Check include patterns
    const isIncluded =
      include.length === 0 || matchesAnyPattern(path, include);

    // Check exclude patterns
    const isExcluded = exclude.length > 0 && matchesAnyPattern(path, exclude);

    return isIncluded && !isExcluded;
  });
}
