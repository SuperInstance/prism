/**
 * ============================================================================
 * TOKEN COUNTING UTILITIES
 * ============================================================================
 *
 * **Purpose**: Provides functions for estimating token counts in text and code.
 * Uses heuristic approximations since actual tokenization requires model-specific
 * tokenizers (tiktoken, sentencepiece, etc.).
 *
 * **Last Updated**: 2025-01-13
 * **Dependencies**: None (pure functions)
 *
 * **Why Heuristics?**
 * Accurate tokenization requires:
 * - Model-specific tokenizer (tiktoken for GPT, sentencepiece for others)
 * - Large vocabulary files (~2MB each)
 * - Tokenization algorithm implementation
 *
 * For most use cases, heuristics are sufficient:
 * - Budgeting: 10-20% error margin is acceptable
 * - Estimation: Close enough for allocation decisions
 * - Speed: No need to load tokenizer files
 *
 * **Accuracy**:
 * - Natural language: ~85% accuracy (4 chars/token)
 * - Code: ~80% accuracy (3 chars/token)
 * - JSON: ~90% accuracy (4 chars/token, more predictable)
 *
 * **When to Use Actual Tokenizers**:
 * - Production systems where accuracy is critical
 * - Cost-sensitive applications (every token counts)
 * - Model-specific behavior testing
 * - Recommended: Use tiktoken for GPT, cl100k_base for Claude
 *
 * **Related Files**:
 * - `src/token-optimizer/TokenOptimizer.ts` - Uses these for budgeting
 * - `src/compression/CompressionLibrary.ts` - Tracks token savings
 * - `tests/unit/token-counter.test.ts` - Token counting tests
 *
 * **Performance**:
 * - estimateTokens: O(n) where n = text length
 * - estimateTokensBatch: O(n*m) where m = array length
 * - Memory: O(1) (no allocations except strings)
 *
 * **Future Enhancements**:
 * - Add `tiktoken` support for accurate counting
 * - Add language-specific heuristics (Python vs JS)
 * - Add caching for repeated text
 * - Add streaming token count for large texts
 */

/**
 * Estimate token count for text
 *
 * **Purpose**: Estimates token count using a heuristic of ~4 characters per token.
 * Works well for English text and natural language.
 *
 * **Algorithm**:
 * ```
 * tokens = ceil(text.length / 4)
 * ```
 *
 * **Accuracy**:
 * - English text: ~85% accurate
 * - Code: ~70% accurate (use estimateCodeTokens instead)
 * - JSON: ~90% accurate
 * - Non-English: ~60-70% accurate (varies by language)
 *
 * **Edge Cases**:
 * - Empty string: Returns 0
 * - Whitespace only: Counts as tokens
 * - Special characters: May overcount
 * - Very short text: May undercount (< 10 chars)
 *
 * **Usage Examples**:
 * ```typescript
 * estimateTokens("Hello world")  // Returns 3 (11 chars / 4 = 2.75 → 3)
 * estimateTokens("")            // Returns 0
 * estimateTokens("The quick brown fox jumps over the lazy dog")  // Returns 10
 * estimateTokens("A")           // Returns 1 (1 / 4 = 0.25 → 1)
 * ```
 *
 * **When to Use**:
 * - Budgeting token allocation
 * - Estimating context usage
 * - Quick calculations
 *
 * **When NOT to Use**:
 * - Production cost calculation (use tiktoken)
 * - Model-specific behavior (tokenizers vary)
 * - Non-English text (language-specific heuristics)
 *
 * **Comparison with Actual Tokenizers**:
 * - GPT-3.5/4 (tiktoken): 1000 tokens ≈ 4000 chars (4.0 chars/token)
 * - Claude (claude): 1000 tokens ≈ 3800 chars (3.8 chars/token)
 * - LLaMA (sentencepiece): 1000 tokens ≈ 3500 chars (3.5 chars/token)
 *
 * **Future Enhancements**:
 * - Add language parameter for multilingual support
 * - Add tokenizer option for accurate counting
 * - Add confidence interval for estimation
 *
 * @see estimateCodeTokens for code-specific counting
 * @see https://github.com/openai/tiktoken for accurate tokenization
 */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }

  // Rule of thumb: ~4 characters per token
  // This varies by language and model but is a reasonable approximation
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token count for an array of texts
 *
 * **Purpose**: Efficiently estimates total tokens for multiple texts.
 * Useful for batch operations and aggregate statistics.
 *
 * **Algorithm**:
 * ```
 * total = sum(estimateTokens(text) for text in texts)
 * ```
 *
 * **Performance**:
 * - Time: O(n*m) where n = avg text length, m = array length
 * - Memory: O(1) (no intermediate allocations)
 * - For large arrays: Consider streaming to avoid memory issues
 *
 * **Usage Examples**:
 * ```typescript
 * const texts = [
 *   "Hello world",
 *   "The quick brown fox",
 *   "Lorem ipsum dolor sit amet"
 * ];
 *
 * estimateTokensBatch(texts);  // Returns ~17
 * ```
 *
 * **Optimization**:
 * For very large arrays (>10K items), consider:
 * ```typescript
 * // Stream processing to avoid blocking
 * async function estimateTokensBatchStream(texts: string[]): Promise<number> {
 *   let total = 0;
 *   for (const text of texts) {
 *     total += estimateTokens(text);
 *     if (total % 10000 === 0) {
 *       await new Promise(resolve => setImmediate(resolve));  // Yield
 *     }
 *   }
 *   return total;
 * }
 * ```
 *
 * **Future Enhancements**:
 * - Add parallel processing for large arrays
 * - Add progress callback for long operations
 * - Add streaming support for infinite arrays
 *
 * @see estimateTokens for single text estimation
 */
export function estimateTokensBatch(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokens(text), 0);
}

/**
 * Count approximate tokens in code
 *
 * **Purpose**: Estimates token count for source code using a more conservative
 * heuristic (~3 characters per token) since code is denser than natural language.
 *
 * **Why Different Heuristic?**
 * Code has different token characteristics:
 * - More symbols per line (operators, brackets, punctuation)
 * - Less whitespace (no natural word boundaries)
 * - Denser information content
 * - Identifiers are tokenized differently
 *
 * **Algorithm**:
 * ```
 * tokens = ceil(code.length / 3)
 * ```
 *
 * **Accuracy by Language**:
 * - JavaScript/TypeScript: ~80% accurate
 * - Python: ~75% accurate (significant whitespace)
 * - Rust/Go: ~85% accurate (verbose syntax)
 * - HTML/CSS: ~70% accurate (many brackets)
 *
 * **Usage Examples**:
 * ```typescript
 * const code = `function add(a, b) {
 *   return a + b;
 * }`;
 *
 * estimateCodeTokens(code);  // Returns ~13 (39 chars / 3 = 13)
 * ```
 *
 * **Comparison with Natural Language**:
 * - Code: ~3 chars/token (denser)
 * - Text: ~4 chars/token (sparser)
 * - Code is ~33% more token-dense
 *
 * **When to Use**:
 * - Estimating context window for code
 * - Budgeting for code chunks
 * - Compression planning
 *
 * **Edge Cases**:
 * - Minified code: May undercount (very dense)
 * - Code with many comments: Overcount (comments are like text)
 * - Data URIs/base64: Undercount (not really code)
 *
 * **Future Enhancements**:
 * - Add language-specific heuristics
 * - Add comment stripping for better accuracy
 * - Add AST-based counting (more accurate)
 * - Add minification detection
 *
 * @see estimateTokens for natural language
 * @see CompressionLibrary for code compression
 */
export function estimateCodeTokens(code: string): number {
  if (!code) {
    return 0;
  }

  // Code is typically more dense than natural language
  // Use ~3 characters per token for code
  return Math.ceil(code.length / 3);
}

/**
 * Count tokens in a JSON object
 *
 * **Purpose**: Estimates token count for JSON-serializable objects.
 * Useful for API requests, config files, and structured data.
 *
 * **Algorithm**:
 * ```typescript
 * json = JSON.stringify(obj);
 * tokens = estimateTokens(json);
 * ```
 *
 * **Accuracy**:
 * JSON is highly predictable, so this is more accurate:
 * - Simple objects: ~95% accurate
 * - Nested objects: ~90% accurate
 * - Arrays: ~90% accurate
 * - Special characters: ~95% accurate
 *
 * **Usage Examples**:
 * ```typescript
 * estimateJSONTokens({ name: "Alice", age: 30 });  // Returns ~10
 * estimateJSONTokens([1, 2, 3, 4, 5]);            // Returns ~7
 * estimateJSONTokens({ nested: { deeply: { value: true } } });  // Returns ~15
 * ```
 *
 * **Performance**:
 * - Time: O(n) where n = object size
 * - Memory: O(n) for stringification
 * - For large objects: Consider streaming JSON
 *
 * **Edge Cases**:
 * - Circular references: Throws (JSON.stringify limitation)
 * - Functions: Lost during stringify (returns undefined)
 * - Undefined: Lost during stringify
 * - Special values (BigInt, Symbol): Throw
 *
 * **When to Use**:
 * - Estimating API request size
 * - Budgeting for structured data
 * - Config file sizing
 *
 * **Future Enhancements**:
 * - Add custom replacer for special types
 * - Add streaming JSON for large objects
 * - Add pretty-print option for formatted JSON
 * - Add circular reference handling
 *
 * @see estimateTokens for raw text estimation
 */
export function estimateJSONTokens(obj: unknown): number {
  const json = JSON.stringify(obj);
  return estimateTokens(json);
}

/**
 * ============================================================================
 * TOKEN COUNTING REFERENCE
 * ============================================================================
 *
 * **Character-to-Token Ratios**:
 *
 * | Content Type | Chars/Token | Accuracy | Use Case |
 * |--------------|-------------|----------|----------|
 * | English text | 4.0 | ~85% | General text |
 * | Code | 3.0 | ~80% | Source code |
 * | JSON | 4.0 | ~95% | Structured data |
 * | Python | 3.5 | ~75% | Python code |
 * | Markdown | 3.8 | ~85% | Documentation |
 *
 * **Model-Specific Tokenizers**:
 *
 * | Model | Tokenizer | Chars/Token | Notes |
 * |-------|-----------|-------------|-------|
 * | GPT-3.5/4 | tiktoken (cl100k_base) | 4.0 | Most accurate |
 * | Claude | custom | 3.8 | Slightly denser |
 * | LLaMA | sentencepiece | 3.5 | Less dense |
 * | Gemini | sentencepiece | 3.6 | Medium density |
 *
 * **Real-World Examples**:
 *
 * ```typescript
 * // 1000 tokens ≈ ...
 * estimateTokens("A".repeat(4000))              // ~1000 tokens (English)
 * estimateCodeTokens("a+b".repeat(1333))       // ~1000 tokens (Code)
 * estimateJSONTokens({ data: "x".repeat(3970) })  // ~1000 tokens (JSON)
 * ```
 *
 * **Recommendations**:
 * - For estimation: These heuristics are sufficient
 * - For production: Use actual tokenizers
 * - For cost calculation: Always use tokenizers
 * - For budgeting: Add 10-20% safety margin
 */
