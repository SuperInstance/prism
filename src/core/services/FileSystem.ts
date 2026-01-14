/**
 * File system service implementation
 *
 * Provides file operations for the PRISM system.
 * Works with both Node.js (fs.promises) and browser/Web Worker environments.
 */

import type {
  IFileSystem,
  FileStats,
} from '../interfaces/index.js';
import { createPrismError, ErrorCode } from '../types/index.js';
import {
  isSourceFile,
  getLanguage,
  matchesGlob,
} from '../utils/file.js';

/**
 * File system service implementation
 *
 * Provides a unified interface for file operations across different environments.
 */
export class FileSystemService implements IFileSystem {
  /**
   * Read file contents
   *
   * @param filePath - Absolute path to file
   * @returns File contents as string
   * @throws {PrismError} If file doesn't exist or can't be read
   */
  async readFile(filePath: string): Promise<string> {
    try {
      // In browser/Workers environment, use fetch
      if (typeof window !== 'undefined' || typeof importScripts !== 'undefined') {
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        return await response.text();
      }

      // In Node.js environment, use fs
      if (typeof process !== 'undefined' && process.versions?.node) {
        const fs = await import('fs/promises');
        try {
          return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw createPrismError(
              ErrorCode.FILE_NOT_FOUND,
              `File not found: ${filePath}`
            );
          }
          throw error;
        }
      }

      throw createPrismError(
        ErrorCode.FILE_NOT_FOUND,
        'Unsupported environment for file operations'
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'PrismError') {
        throw error;
      }
      throw createPrismError(
        ErrorCode.FILE_NOT_FOUND,
        `Failed to read file: ${filePath}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Write contents to file
   *
   * @param filePath - Absolute path to file
   * @param content - Content to write
   * @throws {PrismError} If write fails
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // In browser/Workers environment, writing is limited
      if (typeof window !== 'undefined' || typeof importScripts !== 'undefined') {
        throw createPrismError(
          ErrorCode.FILE_NOT_FOUND,
          'File writing not supported in browser/Workers environment'
        );
      }

      // In Node.js environment, use fs
      if (typeof process !== 'undefined' && process.versions?.node) {
        const fs = await import('fs/promises');
        const path = await import('path');

        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(filePath, content, 'utf-8');
        return;
      }

      throw createPrismError(
        ErrorCode.FILE_NOT_FOUND,
        'Unsupported environment for file operations'
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'PrismError') {
        throw error;
      }
      throw createPrismError(
        ErrorCode.FILE_NOT_FOUND,
        `Failed to write file: ${filePath}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Check if file exists
   *
   * @param filePath - Absolute path to file
   * @returns True if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      // In browser/Workers environment, use fetch with HEAD
      if (typeof window !== 'undefined' || typeof importScripts !== 'undefined') {
        const response = await fetch(filePath, { method: 'HEAD' });
        return response.ok;
      }

      // In Node.js environment, use fs
      if (typeof process !== 'undefined' && process.versions?.node) {
        const fs = await import('fs/promises');
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * List files in directory
   *
   * @param dirPath - Absolute path to directory
   * @param options - Options for listing
   * @returns Array of file paths
   * @throws {PrismError} If directory doesn't exist
   */
  async listFiles(
    dirPath: string,
    options: { recursive?: boolean; pattern?: string } = {}
  ): Promise<string[]> {
    const { recursive = false, pattern } = options;

    try {
      // In browser/Workers environment, directory listing is limited
      if (typeof window !== 'undefined' || typeof importScripts !== 'undefined') {
        throw createPrismError(
          ErrorCode.FILE_NOT_FOUND,
          'Directory listing not supported in browser/Workers environment'
        );
      }

      // In Node.js environment, use fs
      if (typeof process !== 'undefined' && process.versions?.node) {
        const fs = await import('fs/promises');
        const path = await import('path');

        let files: string[] = [];

        if (recursive) {
          // Recursive directory traversal
          const walkDir = async (currentPath: string): Promise<void> => {
            try {
              const entries = await fs.readdir(currentPath, { withFileTypes: true });

              for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                if (entry.isDirectory()) {
                  // Skip common directories to ignore
                  const baseName = path.basename(fullPath);
                  if (
                    !['node_modules', '.git', 'dist', 'build', '.next'].includes(
                      baseName
                    )
                  ) {
                    await walkDir(fullPath);
                  }
                } else if (entry.isFile()) {
                  // Apply pattern filter if provided
                  if (!pattern || matchesGlob(fullPath, pattern)) {
                    files.push(fullPath);
                  }
                }
              }
            } catch (error) {
              // Skip directories we can't read
              console.debug(`Skipping directory: ${currentPath}`);
            }
          };

          await walkDir(dirPath);
        } else {
          // Non-recursive listing
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          files = entries
            .filter((entry) => entry.isFile())
            .map((entry) => path.join(dirPath, entry.name))
            .filter(
              (file: string) => !pattern || matchesGlob(file, pattern)
            );
        }

        return files;
      }

      throw createPrismError(
        ErrorCode.FILE_NOT_FOUND,
        'Unsupported environment for file operations'
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'PrismError') {
        throw error;
      }
      throw createPrismError(
        ErrorCode.FILE_NOT_FOUND,
        `Failed to list directory: ${dirPath}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get file stats
   *
   * @param filePath - Absolute path to file
   * @returns File statistics
   * @throws {PrismError} If file doesn't exist
   */
  async getStats(filePath: string): Promise<FileStats> {
    try {
      // In browser/Workers environment, use HEAD request
      // @ts-ignore - window and importScripts may not be defined in all environments
      if (typeof window !== 'undefined' || typeof importScripts !== 'undefined') {
        const response = await fetch(filePath, { method: 'HEAD' });
        if (!response.ok) {
          throw createPrismError(
            ErrorCode.FILE_NOT_FOUND,
            `File not found: ${filePath}`
          );
        }

        const contentLength = response.headers.get('content-length');
        const lastModified = response.headers.get('last-modified');

        return {
          size: contentLength ? parseInt(contentLength, 10) : 0,
          modified: lastModified ? new Date(lastModified) : new Date(),
          isDirectory: false,
          extension: this.getExtension(filePath),
        };
      }

      // In Node.js environment, use fs
      // @ts-ignore - process may not be defined in all environments
      if (typeof process !== 'undefined' && process.versions?.node) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const fs = await import('fs/promises');

        const stats = await fs.stat(filePath);

        return {
          size: stats.size,
          modified: stats.mtime,
          isDirectory: stats.isDirectory(),
          extension: this.getExtension(filePath),
        };
      }

      throw createPrismError(
        ErrorCode.FILE_NOT_FOUND,
        'Unsupported environment for file operations'
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'PrismError') {
        throw error;
      }
      throw createPrismError(
        ErrorCode.FILE_NOT_FOUND,
        `Failed to get file stats: ${filePath}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Check if a file is a source code file
   *
   * @param filePath - Path to file
   * @returns True if file has a source code extension
   */
  isSourceFile(filePath: string): boolean {
    return isSourceFile(filePath);
  }

  /**
   * Get programming language from file path
   *
   * @param filePath - Path to file
   * @returns Language identifier
   */
  getLanguage(filePath: string): string {
    return getLanguage(filePath);
  }

  /**
   * Get file extension from path
   *
   * @param filePath - Path to file
   * @returns File extension including dot
   */
  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    const lastSlash = filePath.lastIndexOf('/');

    // Ensure dot is after last slash
    if (lastDot === -1 || lastDot < lastSlash) {
      return '';
    }

    return filePath.slice(lastDot);
  }
}
