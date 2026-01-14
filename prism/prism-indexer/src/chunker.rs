use crate::types::{CodeChunk, FunctionInfo, ClassInfo, ImportInfo};
use tree_sitter::Node;
use uuid::Uuid;

/// Default chunk size (in tokens)
pub const DEFAULT_CHUNK_SIZE: usize = 512;
pub const DEFAULT_OVERLAP: usize = 128;
pub const MAX_CHUNK_SIZE: usize = 1000;

/// Chunk code into semantic units
pub fn chunk_code(root: &Node, source: &str, language: &str) -> Vec<CodeChunk> {
    let mut chunks = Vec::new();

    // Extract functions and classes first
    let functions = crate::extractor::extract_functions(root, source);
    let classes = crate::extractor::extract_classes(root, source);

    // For now, create a single chunk for the entire file
    // TODO: Implement proper semantic chunking
    let text = source.to_string();
    let token_count = estimate_tokens(&text);

    chunks.push(CodeChunk {
        id: Uuid::new_v4().to_string(),
        text,
        start_line: 1,
        end_line: source.lines().count(),
        tokens: token_count,
        language: language.to_string(),
        functions: functions.clone(),
        classes: classes.clone(),
        imports: Vec::new(),
        dependencies: Vec::new(),
    });

    chunks
}

/// Estimate token count from text
fn estimate_tokens(text: &str) -> usize {
    // Rough estimation: ~4 characters per token
    text.len() / 4
}

/// Split large chunks into smaller pieces
pub fn split_large_chunk(chunk: &CodeChunk, target_size: usize) -> Vec<CodeChunk> {
    // TODO: Implement AST-aware chunk splitting
    // For now, return the original chunk
    vec![chunk.clone()]
}
