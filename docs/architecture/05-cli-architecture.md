# CLI Architecture

**Component**: PRISM CLI Layer
**Status**: Design Document
**Priority**: Foundational
**Last Updated**: 2026-01-13

## Purpose

This document describes the architecture of the PRISM CLI layer, including command parsing, option handling, error display, and integration with the service layer. The CLI is the primary user-facing interface for PRISM and must be intuitive, responsive, and robust.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [CLI Layer Design](#2-cli-layer-design)
3. [Command Flow](#3-command-flow)
4. [Service Integration](#4-service-integration)
5. [Error Handling](#5-error-handling)
6. [Output Formatting](#6-output-formatting)
7. [Progress Display](#7-progress-display)
8. [Configuration Management](#8-configuration-management)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│                                                             │
│  $ prism search "authentication flow" --limit 20           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      CLI LAYER                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Command Parser (Commander)              │  │
│  │  • Parse arguments                                   │  │
│  │  • Validate options                                  │  │
│  │  • Apply aliases                                     │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐  │
│  │           Command Router (CLI Router)                │  │
│  │  • Route to appropriate command handler              │  │
│  │  • Apply global options                              │  │
│  │  • Set up error handlers                             │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐  │
│  │         Command Handler (Specific to each command)   │  │
│  │  • Execute command logic                             │  │
│  │  • Call service layer                                │  │
│  │  • Handle errors                                     │  │
│  │  • Format output                                     │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                            │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Indexer  │  │ Vector   │  |Optimizer │  │  Router  │  │
│  │ Service  │  │ Service  │  │ Service  │  │ Service  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **CLI Framework** | Commander.js | Most popular, well-maintained, TypeScript support |
| **Validation** | Zod | Type-safe validation, good error messages |
| **Output Formatting** | Chalk + Ora | Colors, spinners, progress bars |
| **Config Management** | Cosmiconfig | Multi-format config (YAML, JSON, JS) |
| **Error Handling** | Custom error classes | Consistent error codes and messages |

---

## 2. CLI Layer Design

### 2.1 Command Parser (Commander.js)

The command parser is responsible for:

1. **Argument Parsing**: Convert command-line strings into structured data
2. **Option Validation**: Ensure options are valid and within bounds
3. **Help Generation**: Provide contextual help for each command
4. **Version Display**: Show version information

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('prism')
  .description('AI-powered codebase indexer and semantic search')
  .version('0.1.0');

// Global options
program
  .option('-c, --config <path>', 'Path to config file', '~/.prism/config.yaml')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info');

// Commands
program
  .command('index')
  .description('Build or update codebase index')
  .option('-p, --path <dir>', 'Path to codebase root', '.')
  .option('-e, --extensions <exts>', 'File extensions to index')
  .option('--exclude <patterns>', 'Paths to exclude')
  .option('-f, --force', 'Force full reindex')
  .option('--format <fmt>', 'Output format (text, json)', 'text')
  .action(handleIndexCommand);
```

### 2.2 Command Router

The command router:

1. **Routes Commands**: Directs to appropriate handler
2. **Applies Global Options**: Sets verbose/quiet mode
3. **Loads Configuration**: Merges config from file and env vars
4. **Sets Up Error Handlers**: Global error catching

```typescript
interface CommandRouter {
  route(command: string, options: ParsedOptions): Promise<void>;
  loadConfig(): Promise<Config>;
  applyGlobalOptions(options: ParsedOptions): void;
  handleError(error: Error): void;
}

class CLICommandRouter implements CommandRouter {
  async route(command: string, options: ParsedOptions): Promise<void> {
    try {
      // Load configuration
      const config = await this.loadConfig();

      // Apply global options
      this.applyGlobalOptions(options);

      // Route to handler
      switch (command) {
        case 'index':
          await handleIndexCommand(options, config);
          break;
        case 'search':
          await handleSearchCommand(options, config);
          break;
        case 'chat':
          await handleChatCommand(options, config);
          break;
        case 'stats':
          await handleStatsCommand(options, config);
          break;
        default:
          throw new CLIError(`Unknown command: ${command}`, 'UNKNOWN_COMMAND');
      }
    } catch (error) {
      this.handleError(error as Error);
    }
  }
}
```

### 2.3 Command Handlers

Each command has a dedicated handler:

```typescript
interface CommandHandler {
  execute(options: ParsedOptions, config: Config): Promise<CommandResult>;
  validate(options: ParsedOptions): Promise<ValidationResult>;
  format(result: CommandResult, format: OutputFormat): string;
}

class IndexCommandHandler implements CommandHandler {
  async execute(options: ParsedOptions, config: Config): Promise<IndexResult> {
    // 1. Validate options
    await this.validate(options);

    // 2. Call service layer
    const indexer = new IndexerService(config);
    const result = await indexer.index({
      path: options.path,
      extensions: options.extensions?.split(','),
      exclude: options.exclude?.split(','),
      force: options.force,
    });

    // 3. Return result
    return result;
  }

  async validate(options: ParsedOptions): Promise<ValidationResult> {
    const schema = z.object({
      path: z.string().min(1),
      extensions: z.string().optional(),
      exclude: z.string().optional(),
      force: z.boolean(),
    });

    return schema.parseAsync(options);
  }

  format(result: IndexResult, format: OutputFormat): string {
    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    }

    // Text format
    return `
Indexing ${result.path}...
✓ Found ${result.filesFound} files
✓ Parsed ${result.filesParsed} files (${result.parseTime}ms)
✓ Extracted ${result.elementsExtracted} elements
✓ Generated ${result.embeddingsGenerated} embeddings (${result.embeddingTime}ms)
✓ Indexed ${result.chunksIndexed} chunks (${result.indexTime}ms)

Index complete!
Files: ${result.filesIndexed} | Chunks: ${result.chunksIndexed} | Time: ${result.totalTime}ms
Storage: ${result.storagePath} (${formatBytes(result.storageSize)})
    `.trim();
  }
}
```

---

## 3. Command Flow

### 3.1 Typical Command Execution Flow

```
User Input
    │
    ▼
┌─────────────────────────┐
│  Parse Command Line     │
│  (Commander.js)         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Load Configuration     │
│  (File → Env → Defaults)│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Validate Options       │
│  (Zod schemas)          │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Execute Command        │
│  (Service Layer)        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Format Output          │
│  (Text/JSON/Markdown)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Display to User        │
│  (stdout/stderr)        │
└─────────────────────────┘
```

### 3.2 Error Handling Flow

```
Error Thrown
    │
    ▼
┌─────────────────────────┐
│  Catch by Router        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Classify Error         │
│  (CLIError, SystemError)│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Generate Error Message │
│  (with suggestions)     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Format Output          │
│  (colored if terminal)  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Write to stderr        │
│  Set exit code          │
└─────────────────────────┘
```

### 3.3 Progress Display Flow

```
Command Start
    │
    ▼
┌─────────────────────────┐
│  Create Progress Spinner│
│  (Ora)                  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Execute Service        │
│  (with callbacks)       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Update Progress        │
│  (spinner text/percent) │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Complete Spinner       │
│  (show final message)   │
└─────────────────────────┘
```

---

## 4. Service Integration

### 4.1 Service Layer Interface

The CLI calls the service layer through well-defined interfaces:

```typescript
interface IndexerService {
  index(options: IndexOptions): Promise<IndexResult>;
}

interface VectorService {
  search(query: string, options: SearchOptions): Promise<SearchResult>;
  upsert(vectors: Vector[]): Promise<number>;
}

interface OptimizerService {
  reconstructPrompt(
    query: string,
    codebase: CodeChunk[],
    budget: number
  ): Promise<OptimizedPrompt>;
}

interface RouterService {
  selectModel(
    tokens: number,
    complexity: number,
    ollamaAvailable: boolean
  ): ModelChoice;
}
```

### 4.2 Service Instantiation

Services are instantiated based on configuration:

```typescript
class ServiceFactory {
  createIndexer(config: Config): IndexerService {
    if (config.indexing.workers > 1) {
      return new ParallelIndexerService(config);
    }
    return new IndexerService(config);
  }

  createVectorService(config: Config): VectorService {
    switch (config.storage.type) {
      case 'sqlite':
        return new SQLiteVectorService(config.storage.path);
      case 'vectorize':
        return new VectorizeService(config.cloudflare);
      default:
        throw new Error(`Unknown storage type: ${config.storage.type}`);
    }
  }

  createEmbeddingsService(config: Config): EmbeddingsService {
    switch (config.embeddings.provider) {
      case 'cloudflare':
        return new CloudflareEmbeddingsService(config.cloudflare);
      case 'ollama':
        return new OllamaEmbeddingsService(config.ollama);
      default:
        return new AutoEmbeddingsService(config);
    }
  }
}
```

### 4.3 Error Propagation

Service errors are caught and converted to CLI-friendly errors:

```typescript
async function handleIndexCommand(options: ParsedOptions, config: Config) {
  try {
    const indexer = serviceFactory.createIndexer(config);
    const result = await indexer.index(options);
    return result;
  } catch (error) {
    // Convert service errors to CLI errors
    if (error instanceof IndexingError) {
      throw new CLIError(
        `Indexing failed: ${error.message}`,
        'INDEX_ERROR',
        error.suggestions
      );
    }
    if (error instanceof EmbeddingError) {
      throw new CLIError(
        `Embedding generation failed: ${error.message}`,
        'EMBEDDING_ERROR',
        ['Try using --embeddings ollama', 'Check your internet connection']
      );
    }
    throw error;
  }
}
```

---

## 5. Error Handling

### 5.1 Error Classification

Errors are classified by severity and category:

```typescript
enum ErrorSeverity {
  LOW = 'low',       // Warning, continue
  MEDIUM = 'medium', // Degraded service
  HIGH = 'high',     // Critical, stop operation
}

enum ErrorCategory {
  NETWORK = 'network',
  AUTH = 'auth',
  QUOTA = 'quota',
  PARSE = 'parse',
  STORAGE = 'storage',
  LLM = 'llm',
  VALIDATION = 'validation',
}

class CLIError extends Error {
  code: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  suggestions?: string[];

  constructor(
    message: string,
    code: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    suggestions?: string[]
  ) {
    super(message);
    this.name = 'CLIError';
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.suggestions = suggestions;
  }
}
```

### 5.2 Error Display

Errors are displayed with helpful context:

```typescript
function displayError(error: CLIError): void {
  const chalk = require('chalk');

  // Error header
  console.error(chalk.red(`\n✖ Error ${error.code}: ${error.message}\n`));

  // Error details
  if (error.details) {
    console.error(chalk.gray('Details:'));
    console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
    console.error();
  }

  // Suggestions
  if (error.suggestions && error.suggestions.length > 0) {
    console.error(chalk.yellow('Suggestions:'));
    error.suggestions.forEach((suggestion, i) => {
      console.error(chalk.yellow(`  ${i + 1}. ${suggestion}`));
    });
    console.error();
  }

  // Help link
  console.error(chalk.gray(`For more help, visit: https://docs.prism.ai/errors/${error.code}\n`));
}
```

### 5.3 Exit Codes

Consistent exit codes for scripting:

```typescript
enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGS = 2,
  PARSE_ERROR = 3,
  EMBEDDING_ERROR = 4,
  STORAGE_ERROR = 5,
  INDEX_NOT_FOUND = 6,
  SEARCH_ERROR = 7,
  LLM_ERROR = 8,
  OPTIMIZER_ERROR = 9,
  NETWORK_ERROR = 10,
  AUTH_ERROR = 11,
  QUOTA_EXCEEDED = 12,
  VALIDATION_ERROR = 13,
}

function getExitCode(error: CLIError): ExitCode {
  switch (error.category) {
    case ErrorCategory.PARSE:
      return ExitCode.PARSE_ERROR;
    case ErrorCategory.STORAGE:
      return ExitCode.STORAGE_ERROR;
    case ErrorCategory.LLM:
      return ExitCode.LLM_ERROR;
    case ErrorCategory.AUTH:
      return ExitCode.AUTH_ERROR;
    case ErrorCategory.QUOTA:
      return ExitCode.QUOTA_EXCEEDED;
    case ErrorCategory.VALIDATION:
      return ExitCode.VALIDATION_ERROR;
    default:
      return ExitCode.GENERAL_ERROR;
  }
}
```

---

## 6. Output Formatting

### 6.1 Output Formats

PRISM supports multiple output formats:

```typescript
enum OutputFormat {
  TEXT = 'text',
  JSON = 'json',
  MARKDOWN = 'markdown',
}

interface OutputFormatter {
  format(data: any, format: OutputFormat): string;
}

class SearchOutputFormatter implements OutputFormatter {
  format(results: SearchResult[], format: OutputFormat): string {
    switch (format) {
      case OutputFormat.JSON:
        return JSON.stringify({ results, totalResults: results.length }, null, 2);

      case OutputFormat.MARKDOWN:
        return this.formatMarkdown(results);

      case OutputFormat.TEXT:
      default:
        return this.formatText(results);
    }
  }

  private formatText(results: SearchResult[]): string {
    const chalk = require('chalk');
    let output = chalk.green(`Found ${results.length} results\n\n`);

    results.forEach((result, i) => {
      output += chalk.cyan(`${result.filePath} (${chalk.gray(`score: ${result.score.toFixed(2)})`)})\n`);
      output += chalk.gray(`  Line ${result.lineRange[0]}: ${result.snippet}\n`);
      if (i < results.length - 1) output += '\n';
    });

    return output;
  }

  private formatMarkdown(results: SearchResult[]): string {
    let output = `## Search Results\n\n`;

    results.forEach((result) => {
      output += `### ${result.filePath} (score: ${result.score.toFixed(2)})\n\n`;
      output += '```typescript\n';
      output += `${result.snippet}\n`;
      output += '```\n\n';
    });

    return output;
  }
}
```

### 6.2 Color Support

Colors are automatically disabled when output is not a TTY:

```typescript
import chalk from 'chalk';
import supportsColor from 'supports-color';

// Disable colors if not supported
if (!supportsColor.stdout || process.env.NO_COLOR) {
  chalk.level = 0;
}

// Use colors for output
console.log(chalk.green('Success!'));
console.log(chalk.red('Error!'));
console.log(chalk.yellow('Warning!'));
```

### 6.3 Table Formatting

For tabular data (stats, etc.):

```typescript
import Table from 'cli-table3';

function formatStats(stats: Stats): string {
  const table = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 20],
  });

  table.push(
    ['Queries', stats.queries.toString()],
    ['Tokens Used', formatTokens(stats.tokensUsed)],
    ['Tokens Saved', formatTokens(stats.tokensSaved)],
    ['Savings', `${stats.savingsPercentage.toFixed(1)}%`],
    ['Cost Saved', `$${stats.costSaved.toFixed(2)}`]
  );

  return table.toString();
}
```

---

## 7. Progress Display

### 7.1 Progress Spinners

For operations with indeterminate progress:

```typescript
import ora from 'ora';

async function indexWithProgress(options: IndexOptions): Promise<IndexResult> {
  const spinner = ora('Initializing...').start();

  try {
    spinner.text = 'Scanning files...';
    const files = await scanFiles(options.path);

    spinner.text = `Parsing ${files.length} files...`;
    const parsed = await parseFiles(files);

    spinner.text = 'Generating embeddings...';
    const embeddings = await generateEmbeddings(parsed);

    spinner.text = 'Indexing...';
    const indexed = await indexVectors(embeddings);

    spinner.succeed(`Indexed ${indexed.length} chunks!`);
    return indexed;
  } catch (error) {
    spinner.fail('Indexing failed!');
    throw error;
  }
}
```

### 7.2 Progress Bars

For operations with determinate progress:

```typescript
import cliProgress from 'cli-progress';

async function indexWithProgressBar(files: string[]): Promise<IndexResult> {
  const progressBar = new cliProgress.SingleBar({
    format: 'Indexing [{bar}] {percentage}% | {value}/{total} files',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  progressBar.start(files.length, 0);

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const result = await indexFile(files[i]);
    results.push(result);
    progressBar.update(i + 1);
  }

  progressBar.stop();
  return results;
}
```

### 7.3 Streaming Updates

For long-running operations:

```typescript
async function chatWithStreaming(query: string): Promise<void> {
  const response = await optimizerService.reconstructPrompt(query, codebase, budget);

  // Show optimization progress
  console.log(`\nRetrieved ${response.chunksRetrieved} relevant chunks`);
  console.log(`Selected ${response.chunksUsed} chunks (${response.tokens} tokens)`);
  console.log(`Compressed to ${response.compressedTokens} tokens (${response.compressionRatio}% reduction)`);
  console.log(`Model: ${response.model}\n`);

  // Stream answer
  const stream = await llmService.streamChat(response.prompt);
  for await (const chunk of stream) {
    process.stdout.write(chunk);
  }
  process.stdout.write('\n');
}
```

---

## 8. Configuration Management

### 8.1 Configuration Loading

Configuration is loaded from multiple sources:

```typescript
import { cosmiconfig } from 'cosmiconfig';

interface ConfigLoader {
  load(): Promise<Config>;
}

class PrismConfigLoader implements ConfigLoader {
  async load(): Promise<Config> {
    // 1. Load from file
    const explorer = cosmiconfig('prism', {
      searchPlaces: [
        '.prism/config.yaml',
        '.prism/config.yml',
        '.prismrc',
        '.prismrc.json',
        'prism.config.yaml',
        'prism.config.yml',
      ],
    });

    const result = await explorer.search();
    const fileConfig = result?.config || {};

    // 2. Load from environment
    const envConfig = this.loadFromEnv();

    // 3. Apply defaults
    const defaultConfig = this.getDefaults();

    // 4. Merge (env > file > defaults)
    const config = this.mergeConfigs(defaultConfig, fileConfig, envConfig);

    // 5. Validate
    return this.validate(config);
  }

  private loadFromEnv(): Partial<Config> {
    return {
      cloudflare: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN,
      },
      chat: {
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
      logging: {
        level: process.env.PRISM_LOG_LEVEL as LogLevel,
      },
    };
  }

  private mergeConfigs(...configs: Partial<Config>[]): Config {
    return Object.assign({}, ...configs) as Config;
  }

  private async validate(config: Config): Promise<Config> {
    const schema = z.object({
      indexing: z.object({
        extensions: z.array(z.string()),
        exclude: z.array(z.string()),
        maxSize: z.number().min(0.1).max(100),
        workers: z.number().min(1).max(16),
      }),
      // ... other sections
    });

    return await schema.parseAsync(config);
  }
}
```

### 8.2 Configuration Validation

Configuration is validated before use:

```typescript
import z from 'zod';

const IndexingConfigSchema = z.object({
  extensions: z.array(z.string().regex(/^\.\w+$/, 'Extension must start with dot')),
  exclude: z.array(z.string()),
  maxSize: z.number().min(0.1).max(100),
  workers: z.number().min(1).max(16),
  incremental: z.boolean(),
});

const EmbeddingsConfigSchema = z.object({
  provider: z.enum(['auto', 'cloudflare', 'ollama']),
  model: z.string(),
  batchSize: z.number().min(1).max(100),
  cache: z.boolean(),
});

const ChatConfigSchema = z.object({
  budget: z.number().min(1000).max(200000),
  model: z.enum(['auto', 'ollama', 'haiku', 'sonnet', 'opus']),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().min(256).max(8192),
});

const ConfigSchema = z.object({
  indexing: IndexingConfigSchema,
  embeddings: EmbeddingsConfigSchema,
  chat: ChatConfigSchema,
  // ... other sections
});
```

---

## 9. Testing Strategy

### 9.1 Unit Testing CLI Commands

```typescript
import { describe, it, expect } from 'vitest';
import { IndexCommandHandler } from './commands/index';

describe('IndexCommandHandler', () => {
  it('should validate options', async () => {
    const handler = new IndexCommandHandler();
    const options = { path: '.', force: false };

    const result = await handler.validate(options);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid options', async () => {
    const handler = new IndexCommandHandler();
    const options = { path: '', force: false };

    await expect(handler.validate(options)).rejects.toThrow();
  });

  it('should format output as JSON', () => {
    const handler = new IndexCommandHandler();
    const result = { filesIndexed: 10, chunksCreated: 100 };

    const output = handler.format(result, 'json');
    expect(JSON.parse(output)).toEqual(result);
  });
});
```

### 9.2 Integration Testing CLI Flow

```typescript
describe('CLI Integration', () => {
  it('should execute index command', async () => {
    const { stdout, stderr } = await exec('node dist/cli/index.js index --path ./test/fixtures');

    expect(stdout).toContain('Indexing');
    expect(stdout).toContain('complete!');
    expect(stderr).toBe('');
  });

  it('should handle errors gracefully', async () => {
    const { exitCode } = await exec('node dist/cli/index.js search "test" --path /nonexistent');

    expect(exitCode).toBe(6); // INDEX_NOT_FOUND
  });
});
```

---

## 10. Performance Considerations

### 10.1 Startup Time

- Lazy-load dependencies
- Use async initialization
- Cache parsed configuration

### 10.2 Memory Usage

- Stream large outputs
- Limit concurrent operations
- Use workers for parallel tasks

### 10.3 Responsive UI

- Always show progress for long operations
- Support cancellation (Ctrl+C)
- Provide feedback immediately

---

## 11. Future Enhancements

### 11.1 Interactive Mode

```bash
$ prism chat --interactive
> How does authentication work?
[Answer]
> What about password reset?
[Answer]
> exit
```

### 11.2 Shell Autocompletion

```bash
$ prism search --h<TAB>
--help     --history  --host

$ prism search auth<TAB>
authentication  authorization
```

### 11.3 Plugin System

Allow users to extend CLI with custom commands:

```typescript
// prism-plugin-mycompany.js
export default function(prism) {
  prism.command('audit', 'Audit code for security issues');
}
```

---

**Document Status**: Complete
**Last Updated**: 2026-01-13
**Next Review**: After CLI implementation
