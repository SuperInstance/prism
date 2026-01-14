/**
 * Configuration service implementation
 *
 * Handles loading, validation, and management of PRISM configuration.
 * Supports loading from JSON/YAML files with environment variable overrides.
 */

import type {
  IConfigurationService,
  ValidationError,
} from '../core/interfaces/index.js';
import type {
  PrismConfig,
  ValidationResult,
} from '../config/types/index.js';
import { createPrismError, ErrorCode, Ok, Err } from '../core/types/index.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<PrismConfig> = {
  cloudflare: {
    accountId: '',
    apiKey: '',
    apiEndpoint: 'https://api.cloudflare.com/client/v4',
  },
  ollama: {
    enabled: false,
    url: 'http://localhost:11434',
    model: 'deepseek-coder-v2',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
  },
  indexing: {
    include: ['**/*.{js,ts,jsx,tsx,py,rs,go}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/test/**'],
    watch: false,
    chunkSize: 500,
    maxFileSize: 1024 * 1024, // 1MB
    languages: [],
    chunking: {
      strategy: 'function',
      minSize: 100,
      maxSize: 1000,
      overlap: 50,
      preserveBoundaries: true,
    },
    embedding: {
      provider: 'cloudflare',
      model: '@cf/baai/bge-small-en-v1.5',
      batchSize: 32,
      dimensions: 384,
      cache: true,
    },
  },
  optimization: {
    tokenBudget: 100000,
    minRelevance: 0.5,
    maxChunks: 50,
    compressionLevel: 5,
    weights: {
      semantic: 0.40,
      proximity: 0.25,
      symbol: 0.20,
      recency: 0.10,
      frequency: 0.05,
    },
  },
  mcp: {
    enabled: false,
    host: 'localhost',
    port: 3000,
    debug: false,
    maxConnections: 10,
    timeout: 30000,
  },
  cli: {
    format: 'text',
    color: true,
    progress: true,
    confirm: true,
  },
  logging: {
    level: 'info',
    format: 'pretty',
  },
};

/**
 * Environment variable mapping
 *
 * Maps environment variables to configuration paths.
 */
const ENV_MAPPING: Record<string, string> = {
  // Cloudflare
  CLOUDFLARE_ACCOUNT_ID: 'cloudflare.accountId',
  CLOUDFLARE_API_KEY: 'cloudflare.apiKey',
  CLOUDFLARE_API_ENDPOINT: 'cloudflare.apiEndpoint',

  // Ollama
  OLLAMA_ENABLED: 'ollama.enabled',
  OLLAMA_URL: 'ollama.url',
  OLLAMA_MODEL: 'ollama.model',

  // Optimization
  TOKEN_BUDGET: 'optimization.tokenBudget',
  MIN_RELEVANCE: 'optimization.minRelevance',
  MAX_CHUNKS: 'optimization.maxChunks',

  // MCP
  MCP_ENABLED: 'mcp.enabled',
  MCP_HOST: 'mcp.host',
  MCP_PORT: 'mcp.port',
  MCP_DEBUG: 'mcp.debug',

  // Logging
  LOG_LEVEL: 'logging.level',
  LOG_FORMAT: 'logging.format',
};

/**
 * Configuration validation schemas
 */
const VALIDATION_RULES: Record<
  string,
  { type: string; required?: boolean; min?: number; max?: number }
> = {
  'cloudflare.accountId': { type: 'string' },
  'cloudflare.apiKey': { type: 'string' },
  'ollama.enabled': { type: 'boolean' },
  'ollama.url': { type: 'string' },
  'ollama.model': { type: 'string' },
  'indexing.chunkSize': { type: 'number', min: 100, max: 5000 },
  'indexing.maxFileSize': { type: 'number', min: 1024, max: 1024 * 1024 * 10 },
  'optimization.tokenBudget': { type: 'number', min: 1000, max: 200000 },
  'optimization.minRelevance': { type: 'number', min: 0, max: 1 },
  'optimization.maxChunks': { type: 'number', min: 1, max: 100 },
  'optimization.compressionLevel': { type: 'number', min: 1, max: 10 },
  'mcp.port': { type: 'number', min: 1024, max: 65535 },
  'cli.format': { type: 'string' },
  'logging.level': { type: 'string' },
};

/**
 * Configuration service implementation
 */
export class ConfigurationService implements IConfigurationService {
  private config: PrismConfig | null = null;
  private configFilePath: string | null = null;

  /**
   * Load configuration from file or environment
   *
   * @returns Loaded and validated configuration
   * @throws {PrismError} If configuration is invalid or cannot be loaded
   */
  async load(): Promise<PrismConfig> {
    // Start with defaults
    const config = { ...DEFAULT_CONFIG } as PrismConfig;

    // Try to load from config file
    const configPath = this.findConfigFile();
    if (configPath) {
      this.configFilePath = configPath;
      const fileConfig = await this.loadConfigFile(configPath);
      this.mergeConfig(config, fileConfig);
    }

    // Apply environment variable overrides
    this.applyEnvOverrides(config);

    // Validate final configuration
    const result = this.validate(config);
    if (!result.valid) {
      throw createPrismError(
        ErrorCode.INVALID_CONFIG,
        'Configuration validation failed',
        { errors: result.errors }
      );
    }

    this.config = result.config;
    return this.config;
  }

  /**
   * Validate configuration object
   *
   * @param config - Configuration to validate
   * @returns Validation result with errors if invalid
   */
  validate(config: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    // Basic structure check
    if (!config || typeof config !== 'object') {
      errors.push({
        path: '',
        message: 'Configuration must be an object',
        value: config,
      });
      return { valid: false, errors };
    }

    const cfg = config as Record<string, unknown>;

    // Check required top-level sections
    const requiredSections = ['cloudflare', 'ollama', 'indexing', 'optimization', 'mcp', 'cli', 'logging'];
    for (const section of requiredSections) {
      if (!cfg[section]) {
        errors.push({
          path: section,
          message: `Missing required section: ${section}`,
          value: undefined,
          expected: 'object',
        });
      }
    }

    // Validate specific fields
    for (const [path, rules] of Object.entries(VALIDATION_RULES)) {
      const value = this.getNestedValue(cfg, path);
      const fieldError = this.validateField(path, value, rules);
      if (fieldError) {
        errors.push(fieldError);
      }
    }

    // Validate scoring weights sum to 1.0
    const weights = this.getNestedValue(cfg, 'optimization.weights') as Record<string, number>;
    if (weights) {
      const sum = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        errors.push({
          path: 'optimization.weights',
          message: `Scoring weights must sum to 1.0, got ${sum}`,
          value: weights,
          expected: 'weights summing to 1.0',
        });
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, config: cfg as PrismConfig };
  }

  /**
   * Get a configuration value by key path
   *
   * @param key - Configuration key (dot notation supported)
   * @returns Configuration value or undefined
   */
  get<T>(key: string): T | undefined {
    if (!this.config) {
      throw createPrismError(
        ErrorCode.INVALID_CONFIG,
        'Configuration not loaded. Call load() first.'
      );
    }
    return this.getNestedValue(this.config as Record<string, unknown>, key) as T;
  }

  /**
   * Set a configuration value by key path
   *
   * @param key - Configuration key (dot notation supported)
   * @param value - Value to set
   */
  set<T>(key: string, value: T): void {
    if (!this.config) {
      throw createPrismError(
        ErrorCode.INVALID_CONFIG,
        'Configuration not loaded. Call load() first.'
      );
    }
    this.setNestedValue(this.config as Record<string, unknown>, key, value);
  }

  /**
   * Save configuration to file
   *
   * @returns Promise that resolves when saved
   * @throws {PrismError} If save fails
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw createPrismError(
        ErrorCode.INVALID_CONFIG,
        'Configuration not loaded. Call load() first.'
      );
    }

    if (!this.configFilePath) {
      throw createPrismError(
        ErrorCode.INVALID_CONFIG,
        'No config file path set. Cannot save.'
      );
    }

    try {
      // In browser/Workers environment, use fetch
      // In Node.js environment, use fs (would need different implementation)
      const content = JSON.stringify(this.config, null, 2);
      // Note: This is a placeholder - actual implementation depends on environment
      throw createPrismError(
        ErrorCode.INVALID_CONFIG,
        'Save not implemented in this environment'
      );
    } catch (error) {
      throw createPrismError(
        ErrorCode.INVALID_CONFIG,
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );
    }
  }

  /**
   * Find configuration file in standard locations
   *
   * @returns Path to config file or null
   */
  private findConfigFile(): string | null {
    // In a browser/Workers environment, config files don't exist
    // This would be different for Node.js CLI
    const possiblePaths = [
      './prism.config.json',
      './prism.config.yaml',
      './.prismrc.json',
      './.prismrc.yaml',
    ];

    // Placeholder - actual implementation would check file existence
    return null;
  }

  /**
   * Load configuration from file
   *
   * @param filePath - Path to config file
   * @returns Parsed configuration object
   */
  private async loadConfigFile(filePath: string): Promise<Partial<PrismConfig>> {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load config file: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      const text = await response.text();

      if (filePath.endsWith('.json') || contentType?.includes('json')) {
        return JSON.parse(text);
      }

      // YAML parsing would require a YAML library
      // For now, only JSON is supported
      throw createPrismError(
        ErrorCode.INVALID_CONFIG,
        'YAML config files not yet supported. Use JSON format.'
      );
    } catch (error) {
      throw createPrismError(
        ErrorCode.INVALID_CONFIG,
        `Failed to load config file: ${filePath}`,
        { originalError: error }
      );
    }
  }

  /**
   * Merge source config into target config
   *
   * @param target - Target config object
   * @param source - Source config object
   */
  private mergeConfig(target: PrismConfig, source: Partial<PrismConfig>): void {
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively merge nested objects
        const targetValue = target[key as keyof PrismConfig];
        if (
          targetValue &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
        ) {
          this.mergeConfig(
            targetValue as PrismConfig,
            value as Partial<PrismConfig>
          );
        } else {
          (target as Record<string, unknown>)[key] = value;
        }
      } else {
        (target as Record<string, unknown>)[key] = value;
      }
    }
  }

  /**
   * Apply environment variable overrides to config
   *
   * @param config - Configuration object to modify
   */
  private applyEnvOverrides(config: PrismConfig): void {
    // In browser/Workers, we might access env differently
    // For Node.js, we'd use process.env
    if (typeof process !== 'undefined' && process.env) {
      for (const [envVar, configPath] of Object.entries(ENV_MAPPING)) {
        const envValue = process.env[envVar];
        if (envValue !== undefined) {
          this.setNestedValue(config as Record<string, unknown>, configPath, this.parseEnvValue(envValue));
        }
      }
    }
  }

  /**
   * Parse environment variable value to appropriate type
   *
   * @param value - String value from environment
   * @returns Parsed value
   */
  private parseEnvValue(value: string): unknown {
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num)) return num;

    // Return as string
    return value;
  }

  /**
   * Validate a single configuration field
   *
   * @param path - Field path
   * @param value - Field value
   * @param rules - Validation rules
   * @returns Validation error or null
   */
  private validateField(
    path: string,
    value: unknown,
    rules: { type: string; required?: boolean; min?: number; max?: number }
  ): ValidationError | null {
    const { type, required, min, max } = rules;

    // Check required
    if (required && (value === undefined || value === null)) {
      return {
        path,
        message: `Required field is missing`,
        value,
        expected: type,
      };
    }

    // Skip validation if value is optional and not provided
    if (!required && (value === undefined || value === null)) {
      return null;
    }

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== type) {
      return {
        path,
        message: `Expected type ${type}, got ${actualType}`,
        value,
        expected: type,
      };
    }

    // Range validation for numbers
    if (type === 'number' && typeof value === 'number') {
      if (min !== undefined && value < min) {
        return {
          path,
          message: `Value must be at least ${min}, got ${value}`,
          value,
          expected: `>= ${min}`,
        };
      }
      if (max !== undefined && value > max) {
        return {
          path,
          message: `Value must be at most ${max}, got ${value}`,
          value,
          expected: `<= ${max}`,
        };
      }
    }

    return null;
  }

  /**
   * Get nested value from object using dot notation
   *
   * @param obj - Object to get value from
   * @param path - Dot-separated path
   * @returns Value at path or undefined
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Set nested value in object using dot notation
   *
   * @param obj - Object to set value in
   * @param path - Dot-separated path
   * @param value - Value to set
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    const lastPart = parts.pop()!;
    let current: unknown = obj;

    // Navigate to parent object
    for (const part of parts) {
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        if (!(current as Record<string, unknown>)[part]) {
          (current as Record<string, unknown>)[part] = {};
        }
        current = (current as Record<string, unknown>)[part];
      }
    }

    // Set value
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      (current as Record<string, unknown>)[lastPart] = value;
    }
  }
}
