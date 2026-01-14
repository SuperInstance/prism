mod parser;
mod error;
mod types;
mod chunker;
mod extractor;

use wasm_bindgen::prelude::*;

// Re-export the main parser
pub use parser::PrismParser;
pub use error::PrismError;
pub use types::*;

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Create a new parser instance
#[wasm_bindgen]
pub fn create_parser(language: &str) -> Result<PrismParser, JsValue> {
    PrismParser::new(language).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Parse code and extract chunks (convenience function)
#[wasm_bindgen]
pub fn parse_code(code: &str, language: &str) -> Result<JsValue, JsValue> {
    let mut parser = PrismParser::new(language)?;
    let result = parser.parse(code)?;
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Get supported languages
#[wasm_bindgen]
pub fn get_supported_languages() -> JsValue {
    let languages = vec![
        "typescript",
        "javascript",
        "python",
        "rust",
        "go",
        "java",
    ];
    serde_wasm_bindgen::to_value(&languages).unwrap_or_else(|_| JsValue::NULL)
}

/// Get version information
#[wasm_bindgen]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
