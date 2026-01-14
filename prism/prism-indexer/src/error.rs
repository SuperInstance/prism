use thiserror::Error;

#[derive(Error, Debug)]
pub enum PrismError {
    #[error("Unsupported language: {0}")]
    UnsupportedLanguage(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Chunk size exceeded: {actual} > {max}")]
    ChunkTooLarge { actual: usize, max: usize },
}

impl From<PrismError> for wasm_bindgen::JsValue {
    fn from(error: PrismError) -> Self {
        wasm_bindgen::JsValue::from_str(&error.to_string())
    }
}

pub type Result<T> = std::result::Result<T, PrismError>;
