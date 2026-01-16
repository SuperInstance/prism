#!/usr/bin/env node

/**
 * PRISM Index Compression Manager
 * Handles JSON compression/decompression for efficient index storage
 */

const zlib = require('zlib');
const { promisify } = require('util');
const fs = require('fs').promises;

class IndexCompressor {
  constructor(config = {}) {
    this.config = {
      compressionLevel: 6, // Default gzip level (1-9)
      threshold: 1024, // Only compress files larger than 1KB
      maxRetries: 3,
      ...config
    };

    // Convert callback-based functions to promise-based
    this.gzip = promisify(zlib.gzip);
    this.gunzip = promisify(zlib.gunzip);
    this.deflate = promisify(zlib.deflate);
    this.inflate = promisify(zlib.inflate);
  }

  /**
   * Compress index data using gzip
   */
  async compressIndex(indexData) {
    try {
      // Only compress if data exceeds threshold
      const dataSize = JSON.stringify(indexData).length;
      if (dataSize < this.config.threshold) {
        return {
          compressed: false,
          data: indexData,
          originalSize: dataSize,
          compressedSize: dataSize,
          compressionRatio: 1
        };
      }

      const compressed = await this.gzip(
        JSON.stringify(indexData),
        { level: this.config.compressionLevel }
      );

      return {
        compressed: true,
        data: compressed.toString('base64'),
        originalSize: dataSize,
        compressedSize: compressed.length,
        compressionRatio: dataSize / compressed.length
      };
    } catch (error) {
      console.error('[IndexCompressor] Compression failed:', error.message);
      return {
        compressed: false,
        data: indexData,
        originalSize: JSON.stringify(indexData).length,
        compressedSize: JSON.stringify(indexData).length,
        compressionRatio: 1,
        error: error.message
      };
    }
  }

  /**
   * Decompress index data
   */
  async decompressIndex(compressedData) {
    try {
      if (!compressedData.compressed) {
        return compressedData.data;
      }

      const buffer = Buffer.from(compressedData.data, 'base64');
      const decompressed = await this.gunzip(buffer);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      console.error('[IndexCompressor] Decompression failed:', error.message);
      throw new Error(`Failed to decompress index: ${error.message}`);
    }
  }

  /**
   * Save compressed index to file
   */
  async saveToFile(filePath, indexData) {
    const compressed = await this.compressIndex(indexData);
    const fileData = {
      version: '1.0',
      compressed: compressed.compressed,
      timestamp: Date.now(),
      data: compressed.data,
      metadata: {
        originalSize: compressed.originalSize,
        compressedSize: compressed.compressedSize,
        compressionRatio: compressed.compressionRatio
      }
    };

    await fs.writeFile(filePath, JSON.stringify(fileData, null, 2));
    return compressed;
  }

  /**
   * Load and decompress index from file
   */
  async loadFromFile(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const fileData = JSON.parse(fileContent);

      // Validate file format
      if (!fileData.version || !fileData.data) {
        throw new Error('Invalid index file format');
      }

      // Decompress the data
      const compressedInfo = {
        compressed: fileData.compressed,
        data: fileData.data
      };

      const indexData = await this.decompressIndex(compressedInfo);

      return {
        data: indexData,
        metadata: {
          version: fileData.version,
          timestamp: fileData.timestamp,
          originalSize: fileData.metadata?.originalSize,
          compressedSize: fileData.metadata?.compressedSize,
          compressionRatio: fileData.metadata?.compressionRatio
        }
      };
    } catch (error) {
      console.error('[IndexCompressor] Load failed:', error.message);
      throw new Error(`Failed to load index: ${error.message}`);
    }
  }

  /**
   * Calculate compression statistics for current index
   */
  async calculateCompressionStats(indexData) {
    const originalSize = JSON.stringify(indexData).length;

    // Test different compression levels
    const levels = [1, 3, 6, 9];
    const stats = {};

    for (const level of levels) {
      try {
        const compressed = await this.gzip(
          JSON.stringify(indexData),
          { level }
        );
        stats[level] = {
          compressedSize: compressed.length,
          ratio: originalSize / compressed.length,
          time: 0 // We'll measure time separately
        };
      } catch (error) {
        console.error(`[IndexCompressor] Level ${level} failed:`, error.message);
        stats[level] = { error: error.message };
      }
    }

    return {
      originalSize,
      levels: stats,
      recommendedLevel: this.recommendedCompressionLevel(stats)
    };
  }

  /**
   * Recommend optimal compression level based on stats
   */
  recommendedCompressionLevel(stats) {
    let bestLevel = 6; // Default
    let bestRatio = 0;

    for (const [level, data] of Object.entries(stats)) {
      if (!data.error && data.ratio > bestRatio) {
        bestRatio = data.ratio;
        bestLevel = parseInt(level);
      }
    }

    return bestLevel;
  }

  /**
   * Memory-efficient compression for large datasets
   */
  async streamCompress(inputStream, outputStream) {
    return new Promise((resolve, reject) => {
      const gzip = zlib.createGzip({ level: this.config.compressionLevel });

      inputStream
        .pipe(gzip)
        .pipe(outputStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  /**
   * Memory-efficient decompression for large datasets
   */
  async streamDecompress(inputStream, outputStream) {
    return new Promise((resolve, reject) => {
      const gunzip = zlib.createGunzip();

      inputStream
        .pipe(gunzip)
        .pipe(outputStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  /**
   * Optimize compression configuration based on data characteristics
   */
  optimizeCompressionForData(indexData) {
    const dataSize = JSON.stringify(indexData).length;
    const fileCount = Object.keys(indexData).length;
    const avgFileSize = dataSize / fileCount;

    let recommendedConfig = { ...this.config };

    // Adjust compression level based on data size
    if (dataSize < 1024 * 1024) { // < 1MB
      recommendedConfig.compressionLevel = 3; // Faster compression
    } else if (dataSize > 10 * 1024 * 1024) { // > 10MB
      recommendedConfig.compressionLevel = 9; // Maximum compression
    }

    // Adjust threshold based on file count
    if (fileCount > 1000) {
      recommendedConfig.threshold = 512; // Lower threshold for many files
    } else if (fileCount < 100) {
      recommendedConfig.threshold = 2048; // Higher threshold for few files
    }

    return recommendedConfig;
  }
}

module.exports = IndexCompressor;