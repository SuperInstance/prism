import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { pipeline, Transform } from 'stream';
import { promisify } from 'util';
import * as path from 'path';
import { Logger } from '../src/utils.js';

const streamPipeline = promisify(pipeline);

export interface StreamingOptions {
  bufferSize?: number;
  encoding?: BufferEncoding;
  highWaterMark?: number;
}

export class JSONStreamingHandler {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("JSONStreamingHandler");
  }

  /**
   * Stream large JSON files with efficient parsing
   */
  async* streamParseJSON<T = any>(
    filePath: string,
    options: StreamingOptions = {}
  ): AsyncGenerator<T, void, unknown> {
    const {
      bufferSize = 64 * 1024, // 64KB buffer
      encoding = 'utf8',
      highWaterMark = 1024 * 1024, // 1MB high water mark
    } = options;

    try {
      const stream = createReadStream(filePath, {
        encoding,
        highWaterMark,
        autoClose: true,
      });

      let buffer = '';
      let braceDepth = 0;
      let inString = false;
      let escapeNext = false;
      let objectStart = -1;
      let parseStack: any[] = [];

      for await (const chunk of stream) {
        buffer += chunk;
        let cursor = 0;

        while (cursor < buffer.length) {
          const char = buffer[cursor];

          // Handle string literals
          if (!escapeNext && char === '"') {
            inString = !inString;
          }
          if (char === '\\' && inString) {
            escapeNext = true;
          } else {
            escapeNext = false;
          }

          // Track JSON structure outside of strings
          if (!inString) {
            if (char === '{') {
              if (braceDepth === 0) {
                objectStart = cursor;
              }
              braceDepth++;
            } else if (char === '}') {
              braceDepth--;

              // Complete object found
              if (braceDepth === 0 && objectStart >= 0) {
                const jsonString = buffer.substring(objectStart, cursor + 1);
                try {
                  const parsed = JSON.parse(jsonString);
                  yield parsed;

                  // Remove processed data from buffer
                  buffer = buffer.substring(cursor + 1);
                  cursor = -1; // Will be incremented to 0 at start of next iteration
                  objectStart = -1;
                  parseStack = [];
                } catch (error) {
                  this.logger.debug(`Failed to parse JSON object: ${error.message}`);
                  // Continue searching for complete objects
                }
              }
            } else if (char === '[' && braceDepth === 0) {
              // Start of array
              braceDepth = -1; // Special marker for array
              objectStart = cursor;
            } else if (char === ']' && braceDepth === -1) {
              // End of array - parse as single object
              const jsonString = buffer.substring(objectStart, cursor + 1);
              try {
                const parsed = JSON.parse(jsonString);
                yield parsed;

                buffer = buffer.substring(cursor + 1);
                cursor = -1;
                objectStart = -1;
              } catch (error) {
                this.logger.debug(`Failed to parse JSON array: ${error.message}`);
              }
            }
          }
          cursor++;
        }

        // Clear processed buffer periodically
        if (buffer.length > bufferSize) {
          buffer = buffer.substring(-bufferSize);
        }
      }

      // Handle any remaining data
      if (buffer.trim()) {
        try {
          const remaining = JSON.parse(`[${buffer.trim()}]`);
          if (Array.isArray(remaining)) {
            for (const item of remaining) {
              yield item;
            }
          }
        } catch (error) {
          this.logger.debug(`Failed to parse remaining data: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to stream JSON from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Stream large JSON objects with chunking
   */
  async* streamLargeObject<T = any>(
    obj: Record<string, any>,
    chunkSize: number = 1000
  ): AsyncGenerator<{ key: string; value: any }, void, unknown> {
    const entries = Object.entries(obj);
    let chunk: { key: string; value: any }[] = [];

    for (const [key, value] of entries) {
      chunk.push({ key, value });

      if (chunk.length >= chunkSize) {
        yield chunk;
        chunk = [];
      }
    }

    if (chunk.length > 0) {
      yield chunk;
    }
  }

  /**
   * Stream JSON with efficient stringification
   */
  async streamStringifyJSON(
    data: any,
    outputPath: string,
    options: {
      indent?: number;
      bufferSize?: number;
      highWaterMark?: number;
    } = {}
  ): Promise<void> {
    const {
      indent = 2,
      bufferSize = 64 * 1024,
      highWaterMark = 1024 * 1024,
    } = options;

    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      const outputStream = createWriteStream(outputPath, {
        highWaterMark,
        autoClose: true,
      });

      let firstObject = true;
      await outputStream.write('[\n');

      if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          if (!firstObject) {
            await outputStream.write(',\n');
          }

          const chunk = JSON.stringify(data[i], null, indent);
          await outputStream.write(chunk);
          firstObject = false;
        }
      } else {
        // Handle objects by streaming as key-value pairs
        const entries = Object.entries(data);
        let firstEntry = true;

        for (const [key, value] of entries) {
          if (!firstEntry) {
            await outputStream.write(',\n');
          }

          const chunk = JSON.stringify({
            [key]: value
          }, null, indent);
          await outputStream.write(chunk);
          firstEntry = false;
        }
      }

      await outputStream.write('\n]');
      await outputStream.end();
    } catch (error) {
      this.logger.error(`Failed to stream JSON to ${outputPath}:`, error);
      throw error;
    }
  }

  /**
   * Process large JSON files with streaming transformations
   */
  async processLargeJSON<T = any, R = any>(
    inputPath: string,
    outputPath: string,
    transformer: (obj: T) => R,
    options: StreamingOptions & {
      filter?: (obj: T) => boolean;
      bufferSize?: number;
    } = {}
  ): Promise<{ processed: number; outputSize: number }> {
    const processed = 0;
    const outputStream = createWriteStream(outputPath, {
      highWaterMark: options.highWaterMark || 1024 * 1024,
    });

    try {
      await outputStream.write('[\n');
      let firstObject = true;

      for await (const obj of this.streamParseJSON<T>(inputPath, options)) {
        // Apply filter if provided
        if (options.filter && !options.filter(obj)) {
          continue;
        }

        // Apply transformation
        const transformed = transformer(obj);

        if (!firstObject) {
          await outputStream.write(',\n');
        }

        const jsonStr = JSON.stringify(transformed, null, options.indent || 2);
        await outputStream.write(jsonStr);
        firstObject = false;
        processed++;
      }

      await outputStream.write('\n]');
      await outputStream.end();

      const stats = await fs.stat(outputPath);
      return { processed, outputSize: stats.size };
    } catch (error) {
      this.logger.error(`Failed to process JSON from ${inputPath} to ${outputPath}:`, error);
      throw error;
    }
  }

  /**
   * Merge multiple JSON files using streaming
   */
  async mergeJSONFiles(
    inputPaths: string[],
    outputPath: string,
    options: {
      keyField?: string;
      mergeStrategy?: 'concat' | 'merge' | 'replace';
    } = {}
  ): Promise<{ merged: number; conflicts: number }> {
    const { keyField = 'id', mergeStrategy = 'concat' } = options;
    let merged = 0;
    let conflicts = 0;
    const mergedObjects = new Map<string, any>();

    for (const inputPath of inputPaths) {
      for await (const obj of this.streamParseJSON(inputPath)) {
        const key = obj[keyField];

        if (mergedObjects.has(key)) {
          conflicts++;

          if (mergeStrategy === 'concat' && Array.isArray(mergedObjects.get(key))) {
            mergedObjects.get(key).push(obj);
          } else if (mergeStrategy === 'merge' && typeof obj === 'object' && obj !== null) {
            const existing = mergedObjects.get(key);
            mergedObjects.set(key, { ...existing, ...obj });
          } else {
            // Replace strategy
            mergedObjects.set(key, obj);
          }
        } else {
          mergedObjects.set(key, obj);
        }
        merged++;
      }
    }

    // Write merged results
    await this.streamStringifyJSON(
      Array.from(mergedObjects.values()),
      outputPath,
      { indent: 2 }
    );

    return { merged, conflicts };
  }

  /**
   * Validate JSON file structure using streaming
   */
  async validateJSONStructure(
    filePath: string,
    options: {
      strict?: boolean;
      maxDepth?: number;
      allowedTypes?: string[];
    } = {}
  ): Promise<{
    valid: boolean;
    errors: string[];
    stats: {
      totalObjects: number;
      totalArrays: number;
      totalStrings: number;
      totalNumbers: number;
      maxDepth: number;
    };
  }> {
    const {
      strict = false,
      maxDepth = 100,
      allowedTypes = ['object', 'array', 'string', 'number', 'boolean', 'null'],
    } = options;

    const errors: string[] = [];
    let totalObjects = 0;
    let totalArrays = 0;
    let totalStrings = 0;
    let totalNumbers = 0;
    let maxDepthReached = 0;

    let currentDepth = 0;
    const typeStack: string[] = [];

    try {
      for await (const obj of this.streamParseJSON(filePath)) {
        currentDepth = 0;
        typeStack.push(typeof obj);

        const result = this.validateObject(obj, currentDepth, maxDepth, allowedTypes, strict);
        errors.push(...result.errors);
        totalObjects += result.totalObjects;
        totalArrays += result.totalArrays;
        totalStrings += result.totalStrings;
        totalNumbers += result.totalNumbers;

        if (result.currentDepth > maxDepthReached) {
          maxDepthReached = result.currentDepth;
        }

        typeStack.pop();
      }

      return {
        valid: errors.length === 0,
        errors,
        stats: {
          totalObjects,
          totalArrays,
          totalStrings,
          totalNumbers,
          maxDepth: maxDepthReached,
        },
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        stats: {
          totalObjects,
          totalArrays,
          totalStrings,
          totalNumbers,
          maxDepth: maxDepthReached,
        },
      };
    }
  }

  private validateObject(
    obj: any,
    depth: number,
    maxDepth: number,
    allowedTypes: string[],
    strict: boolean
  ): {
    errors: string[];
    totalObjects: number;
    totalArrays: number;
    totalStrings: number;
    totalNumbers: number;
    currentDepth: number;
  } {
    const errors: string[] = [];
    let totalObjects = 0;
    let totalArrays = 0;
    let totalStrings = 0;
    let totalNumbers = 0;
    let currentDepth = depth;

    if (depth > maxDepth) {
      errors.push(`Maximum depth exceeded: ${depth} > ${maxDepth}`);
      return { errors, totalObjects, totalArrays, totalStrings, totalNumbers, currentDepth };
    }

    const type = typeof obj;
    if (!allowedTypes.includes(type)) {
      errors.push(`Type '${type}' not allowed at depth ${depth}`);
    }

    if (type === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        totalArrays++;
        for (let i = 0; i < obj.length; i++) {
          const result = this.validateObject(obj[i], depth + 1, maxDepth, allowedTypes, strict);
          errors.push(...result.errors);
          totalObjects += result.totalObjects;
          totalArrays += result.totalArrays;
          totalStrings += result.totalStrings;
          totalNumbers += result.totalNumbers;
          currentDepth = Math.max(currentDepth, result.currentDepth);
        }
      } else {
        totalObjects++;
        for (const key in obj) {
          if (strict && !/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(key)) {
            errors.push(`Invalid key '${key}' at depth ${depth}`);
          }
          const result = this.validateObject(obj[key], depth + 1, maxDepth, allowedTypes, strict);
          errors.push(...result.errors);
          totalObjects += result.totalObjects;
          totalArrays += result.totalArrays;
          totalStrings += result.totalStrings;
          totalNumbers += result.totalNumbers;
          currentDepth = Math.max(currentDepth, result.currentDepth);
        }
      }
    } else if (type === 'string') {
      totalStrings++;
    } else if (type === 'number') {
      totalNumbers++;
    }

    return { errors, totalObjects, totalArrays, totalStrings, totalNumbers, currentDepth };
  }
}