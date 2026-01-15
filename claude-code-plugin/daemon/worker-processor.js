#!/usr/bin/env node

/**
 * PRISM Worker File Processor
 * Handles parallel file processing for faster indexing
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

class WorkerFileProcessor {
  constructor(config) {
    this.config = config;
    this.maxMemoryUsage = 0;
    this.totalMemoryUsage = 0;
  }

  /**
   * Process a single file with memory tracking
   */
  async processFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Check file size limit
      if (fileSize > this.config.maxFileSize) {
        return null;
      }

      // Check memory constraint
      if (this.totalMemoryUsage + fileSize > this.config.memoryLimit) {
        return null;
      }

      // Read file content
      let content;
      if (fileSize > 1024 * 1024) { // 1MB+
        content = await this.streamReadFile(filePath, fileSize);
      } else {
        content = await fsPromises.readFile(filePath, 'utf8');
      }

      // Update memory usage
      this.totalMemoryUsage += fileSize;

      return {
        filePath,
        content,
        size: fileSize,
        mtime: stats.mtime.getTime(),
        hash: this.simpleHash(content)
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Stream read large files
   */
  async streamReadFile(filePath, maxSize) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let totalLength = 0;

      try {
        const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

        stream.on('data', (chunk) => {
          totalLength += chunk.length;
          chunks.push(chunk);
        });

        stream.on('end', () => {
          resolve(chunks.join(''));
        });

        stream.on('error', (error) => {
          reject(error);
        });

        // Timeout protection
        const timeout = setTimeout(() => {
          if (!stream.destroyed) {
            stream.destroy();
            reject(new Error(`File read timeout: ${filePath}`));
          }
        }, 5000);

        stream.on('close', () => {
          clearTimeout(timeout);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Simple hash function
   */
  simpleHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Reset memory usage for next batch
   */
  resetMemory() {
    this.totalMemoryUsage = 0;
  }
}

module.exports = WorkerFileProcessor;