use serde::{Deserialize, Serialize};

/// Location in source code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceLocation {
    pub start_row: usize,
    pub start_column: usize,
    pub end_row: usize,
    pub end_column: usize,
}

/// Function information extracted from code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionInfo {
    pub name: String,
    pub signature: String,
    pub start_line: usize,
    pub end_line: usize,
    pub parameters: Vec<String>,
    pub return_type: Option<String>,
    pub is_async: bool,
    pub is_exported: bool,
}

/// Class information extracted from code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassInfo {
    pub name: String,
    pub extends: Option<String>,
    pub implements: Vec<String>,
    pub methods: Vec<FunctionInfo>,
    pub start_line: usize,
    pub end_line: usize,
}

/// Import/Export information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportInfo {
    pub source: String,
    pub imported_names: Vec<String>,
    pub is_type_only: bool,
    pub location: SourceLocation,
}

/// A code chunk for indexing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunk {
    pub id: String,
    pub text: String,
    pub start_line: usize,
    pub end_line: usize,
    pub tokens: usize,
    pub language: String,
    pub functions: Vec<FunctionInfo>,
    pub classes: Vec<ClassInfo>,
    pub imports: Vec<ImportInfo>,
    pub dependencies: Vec<String>,
}

/// Result of parsing code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub has_errors: bool,
    pub error_nodes: Vec<ErrorNode>,
    pub chunks: Vec<CodeChunk>,
    pub functions: Vec<FunctionInfo>,
    pub classes: Vec<ClassInfo>,
}

/// Error node information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorNode {
    pub message: String,
    pub location: SourceLocation,
    pub text: String,
}
