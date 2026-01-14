/**
 * PRISM Worker with Cloudflare Vectorize Integration
 *
 * Architecture:
 * - Vectorize: Fast vector similarity search with ANN indexing
 * - D1: Metadata storage, file tracking, SHA-256 checksums
 * - Workers AI: Embedding generation
 *
 * Benefits:
 * - <10ms search time even for 100K+ chunks
 * - Metadata filtering support
 * - Automatic scaling
 */

// ============================================
// Type Definitions
// ============================================

interface VectorizeVector {
  id: string;
  values: number[];
  metadata?: {
    filePath?: string;
    language?: string;
    startLine?: number;
    endLine?: number;
    checksum?: string;
    [key: string]: string | number | undefined;
  };
}

interface VectorizeMatch {
  id: string;
  score: number;
  vector?: number[];
  metadata?: Record<string, string | number>;
}

interface IndexRequest {
  files?: Array<{
    path: string;
    content: string;
    language?: string;
  }>;
  path?: string;
  options?: {
    incremental?: boolean;
  };
}

interface SearchRequest {
  query: string;
  limit?: number;
  minScore?: number;
  filters?: {
    filePath?: string;
    language?: string;
    pathPrefix?: string;
    createdAfter?: number;
    createdBefore?: number;
  };
}

interface Env {
  // Vectorize index for vector search
  VECTORIZE: VectorizeIndex;

  // D1 database for metadata
  DB: D1Database;

  // Workers AI for embeddings
  AI: Ai;

  // Environment variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  EMBEDDING_MODEL: string;
}

// ============================================
// Simple Router
// ============================================

class WorkerRouter {
  routes = new Map<string, Map<string, Function>>();

  get(path: string, handler: Function) {
    this.addRoute("GET", path, handler);
  }

  post(path: string, handler: Function) {
    this.addRoute("POST", path, handler);
  }

  addRoute(method: string, path: string, handler: Function) {
    if (!this.routes.has(method)) {
      this.routes.set(method, new Map());
    }
    this.routes.get(method)!.set(path, handler);
  }

  async handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    const methodRoutes = this.routes.get(method);
    if (!methodRoutes) {
      return this.notFound();
    }

    let handler = methodRoutes.get(path);
    if (handler) {
      return handler(request, { env, request });
    }

    // Try pattern matching
    for (const [routePath, routeHandler] of methodRoutes.entries()) {
      if (this.matchRoute(routePath, path)) {
        return routeHandler(request, { env, request });
      }
    }

    return this.notFound();
  }

  matchRoute(routePath: string, requestPath: string): boolean {
    const pattern = routePath.replace(/:[^/]+/g, "([^/]+)").replace(/\*/g, ".*");
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(requestPath);
  }

  notFound(): Response {
    return Response.json(
      {
        success: false,
        error: "Not Found",
        message: "The requested endpoint does not exist"
      },
      { status: 404 }
    );
  }
}

// ============================================
// Utility Functions
// ============================================

async function calculateChecksum(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    "ts": "typescript",
    "js": "javascript",
    "tsx": "typescript",
    "jsx": "javascript",
    "py": "python",
    "rs": "rust",
    "go": "go",
    "java": "java",
    "cpp": "cpp",
    "c": "c",
    "h": "c",
    "cs": "csharp",
    "php": "php",
    "rb": "ruby",
    "kt": "kotlin",
    "swift": "swift",
    "sh": "shell",
    "yaml": "yaml",
    "yml": "yaml",
    "json": "json",
    "md": "markdown"
  };
  return languageMap[ext || ""] || "text";
}

function chunkFile(filePath: string, content: string, language: string) {
  const lines = content.split("\n");
  const chunks = [];
  const maxLinesPerChunk = 50;
  let startLine = 0;

  while (startLine < lines.length) {
    const endLine = Math.min(startLine + maxLinesPerChunk, lines.length);
    const chunkContent = lines.slice(startLine, endLine).join("\n");

    if (chunkContent.trim().length > 0) {
      chunks.push({
        content: chunkContent,
        startLine: startLine + 1, // 1-indexed
        endLine,
        language
      });
    }

    startLine = endLine;
  }

  return chunks;
}

async function generateEmbedding(ctx: { env: Env }, text: string): Promise<number[]> {
  try {
    const model = ctx.env.EMBEDDING_MODEL || "@cf/baai/bge-small-en-v1.5";
    const response = await ctx.env.AI.run(model, {
      text: [text]
    }) as { data?: number[][] };

    if (!response || !response.data || !response.data[0] || response.data[0].length === 0) {
      throw new Error("Invalid embedding response");
    }

    return response.data[0];
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function encodeFloat32Array(array: number[]): Uint8Array {
  const float32Array = new Float32Array(array);
  return new Uint8Array(float32Array.buffer);
}

function decodeFloat32Array(blob: Uint8Array | any): number[] {
  let bytes: Uint8Array;
  if (blob instanceof Uint8Array) {
    bytes = blob;
  } else if (Array.isArray(blob)) {
    bytes = new Uint8Array(blob);
  } else if (blob && typeof blob === 'object') {
    if (blob.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(blob.buffer);
    } else {
      bytes = new Uint8Array(Object.values(blob));
    }
  } else {
    console.error("Unexpected blob type:", typeof blob, blob);
    return [];
  }
  const float32Array = new Float32Array(bytes.buffer);
  return Array.from(float32Array);
}

// ============================================
// Endpoint Handlers
// ============================================

async function healthCheck(request: Request, ctx: { env: Env; request: Request }): Promise<Response> {
  try {
    // Check D1
    const dbResult = await ctx.env.DB.prepare("SELECT COUNT(*) as count FROM hnsw_metadata").first();

    // Check Vectorize
    const vectorizeInfo = await ctx.env.VECTORIZE.describe();

    return Response.json({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "0.3.0",
        environment: ctx.env.ENVIRONMENT || "development",
        vectorize: {
          dimensions: vectorizeInfo.dimensions,
          metric: vectorizeInfo.metric,
          count: vectorizeInfo.count
        },
        d1_initialized: dbResult && dbResult.count > 0
      }
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Health check failed"
    }, { status: 500 });
  }
}

async function indexCode(request: Request, ctx: { env: Env; request: Request }): Promise<Response> {
  try {
    const body = await request.json() as IndexRequest;

    if (!body.files && !body.path) {
      return Response.json({
        success: false,
        error: "Missing required field: files or path"
      }, { status: 400 });
    }

    if (body.path && !body.files) {
      return Response.json({
        success: false,
        error: "Direct filesystem access not available in Workers. Please provide files array.",
        message: 'Use { "files": [{"path": "...", "content": "..."}] } instead of { "path": "..." }'
      }, { status: 400 });
    }

    const files = body.files || [];
    const options = body.options || {};
    const startTime = Date.now();

    let indexedFiles = 0;
    let indexedChunks = 0;
    let errors = 0;
    const failedFiles: string[] = [];

    // Batch vectors for Vectorize upsert
    const vectorsToUpsert: VectorizeVector[] = [];

    for (const file of files) {
      try {
        // Check if file needs reindexing (incremental mode)
        if (options.incremental) {
          const existingRecord = await ctx.env.DB.prepare(
            "SELECT checksum, last_modified FROM file_index WHERE path = ?"
          ).bind(file.path).first();

          if (existingRecord) {
            const checksum = await calculateChecksum(file.content);
            if (existingRecord.checksum === checksum) {
              console.log(`Skipping unchanged file: ${file.path}`);
              continue;
            }
          }
        }

        // Chunk the file
        const chunks = chunkFile(file.path, file.content, file.language || detectLanguage(file.path));

        // Generate embeddings for all chunks
        const embeddings: number[][] = [];
        for (const chunk of chunks) {
          try {
            const embedding = await generateEmbedding(ctx, chunk.content);
            embeddings.push(embedding);
          } catch (error) {
            console.error(`Failed to generate embedding for ${file.path}:${chunk.startLine}:`, error);
            throw error;
          }
        }

        // Prepare vectors for Vectorize
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings[i];
          const chunkId = `${file.path}:${i}`;
          const checksum = await calculateChecksum(chunk.content);

          // Add to batch for Vectorize
          vectorsToUpsert.push({
            id: chunkId,
            values: embedding,
            metadata: {
              filePath: file.path,
              language: chunk.language,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              checksum
            }
          });

          // Store full content and embedding in D1 (fallback and compatibility)
          await ctx.env.DB.prepare(`
            INSERT OR REPLACE INTO vector_chunks
            (id, file_path, content, start_line, end_line, language, embedding, checksum, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            chunkId,
            file.path,
            chunk.content,
            chunk.startLine,
            chunk.endLine,
            chunk.language,
            encodeFloat32Array(embedding),
            checksum,
            Date.now(),
            Date.now()
          ).run();
        }

        // Update file index
        const fileChecksum = await calculateChecksum(file.content);
        await ctx.env.DB.prepare(`
          INSERT OR REPLACE INTO file_index
          (path, checksum, file_size, last_modified, last_indexed, chunk_count)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          file.path,
          fileChecksum,
          file.content.length,
          Date.now(),
          Date.now(),
          chunks.length
        ).run();

        indexedFiles++;
        indexedChunks += chunks.length;

      } catch (error) {
        errors++;
        failedFiles.push(file.path);
        console.error(`Failed to index ${file.path}:`, error);
      }
    }

    // Batch upsert to Vectorize (async operation)
    if (vectorsToUpsert.length > 0) {
      try {
        const upsertResult = await ctx.env.VECTORIZE.upsert(vectorsToUpsert);
        console.log(`Vectorize upsert: ${upsertResult.mutationId}, ${vectorsToUpsert.length} vectors`);
      } catch (error) {
        console.error("Vectorize upsert failed:", error);
        // Continue anyway - data is in D1
      }
    }

    const duration = Date.now() - startTime;

    return Response.json({
      success: true,
      data: {
        files: indexedFiles,
        chunks: indexedChunks,
        errors,
        duration,
        failedFiles
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Indexing failed"
    }, { status: 500 });
  }
}

async function searchCode(request: Request, ctx: { env: Env; request: Request }): Promise<Response> {
  try {
    const body = await request.json() as SearchRequest;

    if (!body.query) {
      return Response.json({
        success: false,
        error: "Missing required field: query"
      }, { status: 400 });
    }

    const limit = Math.min(body.limit || 10, 100); // Vectorize max is 100
    const minScore = body.minScore || 0;
    const filters = body.filters || {};

    console.log(`Searching for: "${body.query}" with limit ${limit}`);

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(ctx, body.query);
    console.log(`Query embedding dimension: ${queryEmbedding.length}`);

    // Build Vectorize query options
    const queryOptions: {
      topK: number;
      returnValues: boolean;
      returnMetadata: "none" | "indexed" | "all";
      namespace?: string;
      filter?: VectorizeFilter;
    } = {
      topK: limit * 2, // Get more results to account for filtering
      returnValues: false,
      returnMetadata: "all"
    };

    // Add namespace filter if provided (for multi-tenancy)
    if (filters.pathPrefix) {
      queryOptions.namespace = filters.pathPrefix.replace(/^\/+/, "").replace(/\/+$/, "");
    }

    // Execute vector search
    let matches: VectorizeMatch[];
    try {
      const queryResult = await ctx.env.VECTORIZE.query(queryEmbedding, queryOptions);
      // Vectorize returns { matches: [...] }
      matches = (queryResult as any).matches || queryResult as any;
      console.log(`Vectorize returned ${matches.length} matches`);
    } catch (error) {
      console.error("Vectorize query failed:", error);
      return Response.json({
        success: false,
        error: `Vector search failed: ${error instanceof Error ? error.message : String(error)}`
      }, { status: 500 });
    }

    // Fetch full content from D1 and apply additional filters
    const results = [];
    const processedIds = new Set<string>();

    for (const match of matches) {
      // Skip if score is below threshold
      if (match.score < minScore) continue;

      // Skip duplicates
      if (processedIds.has(match.id)) continue;
      processedIds.add(match.id);

      // Fetch full content from D1
      const chunkRow = await ctx.env.DB.prepare(
        "SELECT id, file_path, content, start_line, end_line, language FROM vector_chunks WHERE id = ?"
      ).bind(match.id).first();

      if (!chunkRow) {
        console.warn(`Chunk ${match.id} not found in D1`);
        continue;
      }

      // Apply additional filters
      if (filters.language && chunkRow.language !== filters.language) continue;
      if (filters.filePath && !chunkRow.file_path.includes(filters.filePath.replace("*", ""))) continue;
      if (filters.pathPrefix && !chunkRow.file_path.startsWith(filters.pathPrefix)) continue;

      results.push({
        id: chunkRow.id,
        filePath: chunkRow.file_path,
        content: chunkRow.content,
        startLine: chunkRow.start_line,
        endLine: chunkRow.end_line,
        language: chunkRow.language,
        score: match.score
      });

      // Stop if we have enough results
      if (results.length >= limit) break;
    }

    console.log(`Returning ${results.length} results after filtering`);

    return Response.json({
      success: true,
      data: {
        results,
        query: body.query,
        total: results.length
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Search failed"
    }, { status: 500 });
  }
}

async function getStats(request: Request, ctx: { env: Env; request: Request }): Promise<Response> {
  try {
    // Get D1 stats
    const chunkCount = await ctx.env.DB.prepare(
      "SELECT COUNT(*) as count FROM vector_chunks WHERE deleted_at IS NULL"
    ).first();

    const fileCount = await ctx.env.DB.prepare(
      "SELECT COUNT(*) as count FROM file_index"
    ).first();

    // Get Vectorize stats
    const vectorizeInfo = await ctx.env.VECTORIZE.describe();

    return Response.json({
      success: true,
      data: {
        chunks: chunkCount?.count || 0,
        files: fileCount?.count || 0,
        vectorize: {
          dimensions: vectorizeInfo.dimensions,
          metric: vectorizeInfo.metric,
          count: vectorizeInfo.count
        },
        indexedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get stats"
    }, { status: 500 });
  }
}

// ============================================
// Router Setup
// ============================================

const router = new WorkerRouter();

// Health check
router.get("/health", healthCheck);

// API endpoints
router.post("/api/index", indexCode);
router.post("/api/search", searchCode);
router.get("/api/stats", getStats);

// ============================================
// Worker Entry Point
// ============================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const response = await router.handle(request, env);

      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });

    } catch (error) {
      return Response.json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
      }, {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
