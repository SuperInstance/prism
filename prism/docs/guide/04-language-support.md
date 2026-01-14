# Language Support Guide

**Last Updated**: 2026-01-13
**Version**: 0.1.0
**Status**: Beta

## Overview

Prism supports multiple programming languages through Tree-sitter grammars, enabling AST-based parsing and semantic understanding across diverse codebases.

**Supported Languages:**
- TypeScript / JavaScript
- Python
- Rust
- Go
- Java

---

## Supported Languages

### TypeScript / JavaScript

**Status:** ✅ Stable
**Grammar:** tree-sitter-typescript v0.23.2
**Extensions:** `.ts`, `.tsx`, `.js`, `.jsx`

**Features:**
- Full TypeScript syntax support
- JSX/TSX for React
- Type annotations
- Decorators
- Async/await
- Generics
- Modules (ESM & CommonJS)

**Parsing Capabilities:**

```typescript
// Function extraction
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Class extraction
class UserService {
  constructor(private db: Database) {}

  async getUser(id: string): Promise<User> {
    return await this.db.find(id);
  }
}

// Import/Export tracking
import { express, Request, Response } from 'express';
export { UserService };

// React components (JSX)
function App({ name }: { name: string }) {
  return <div>Hello, {name}!</div>;
}
```

**Chunking Strategy:**
- **Primary:** Function-level chunking
- **Classes:** Chunk methods individually
- **Components:** Treat as functions
- **Large functions:** Split at 512 tokens

**Known Limitations:**
- Does not execute type checking (structure only)
- Decorators parsed but not deeply analyzed
- Some advanced TypeScript features may have limited extraction

---

### Python

**Status:** ✅ Stable
**Grammar:** tree-sitter-python
**Extensions:** `.py`, `.pyi`

**Features:**
- Python 3 syntax
- Type hints (PEP 484)
- Async/await
- Decorators
- Context managers
- List/dict/set comprehensions
- F-strings

**Parsing Capabilities:**

```python
# Function extraction with type hints
def fetch_user(user_id: str) -> dict[str, Any]:
    """Fetch user from database."""
    return db.query(user_id)

# Class extraction
class UserRepository:
    def __init__(self, connection: Connection):
        self.conn = connection

    async def get_user(self, user_id: str) -> User:
        cursor = await self.conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,)
        )
        return User.from_row(cursor.fetchone())

# Decorators
@dataclass
class User:
    id: str
    name: str

@contextmanager
def transaction():
    yield

# Async functions
async def main():
    async with aiohttp.ClientSession() as session:
        await fetch_data(session)
```

**Chunking Strategy:**
- **Primary:** Function/method-level chunking
- **Classes:** Chunk methods individually
- **Decorators:** Included with decorated entity
- **Type hints:** Preserved in chunks

**Python-Specific Considerations:**
- **Indentation:** Tree-sitter handles this natively
- **Type stubs (`.pyi`):** Supported but treated separately
- **Docstrings:** Extracted as metadata
- **Imports:** Both `import x` and `from x import y` tracked

**Known Limitations:**
- Does not understand Python's dynamic typing
- Metaclasses not deeply analyzed
- Some magic methods may not be extracted

---

### Rust

**Status:** ✅ Stable
**Grammar:** tree-sitter-rust
**Extensions:** `.rs`

**Features:**
- Modern Rust syntax
- Generics and lifetimes
- Macros (declarative and procedural)
- Async/await
- Pattern matching
- Trait implementations

**Parsing Capabilities:**

```rust
// Function extraction with generics
async fn fetch_user<U: UserId>(id: U) -> Result<User, Error> {
    db.query(id).await
}

// Struct extraction
struct User {
    id: String,
    name: String,
    email: String,
}

// Impl blocks (methods)
impl User {
    pub fn new(id: String, name: String) -> Self {
        Self { id, name, email: String::new() }
    }

    pub async fn save(&self, db: &Database) -> Result<(), Error> {
        db.insert(self).await
    }
}

// Trait definitions
trait Repository<T> {
    async fn get(&self, id: &str) -> Result<T, Error>;
    async fn save(&self, item: &T) -> Result<(), Error>;
}

// Macros (parsed structurally)
macro_rules! impl_repository {
    ($type:ty) => {
        impl Repository<$type> for Database {
            // ...
        }
    };
}
```

**Chunking Strategy:**
- **Primary:** Function/method-level chunking
- **Impl blocks:** Chunk methods individually
- **Traits:** Treated as interfaces
- **Macros:** Parsed but not expanded

**Rust-Specific Considerations:**
- **Lifetimes:** Preserved in signatures
- **Generics:** Full type parameter tracking
- **Macros:** Not expanded (structural parsing only)
- **Attributes:** Extracted as metadata

**Known Limitations:**
- Procedural macros not expanded
- Some complex trait bounds may be simplified
- Const generics partially supported

---

### Go

**Status:** ✅ Stable
**Grammar:** tree-sitter-go
**Extensions:** `.go`

**Features:**
- Go 1.x syntax
- Goroutines and channels
- Interfaces
- Structs and methods
- Packages and imports
- Error handling patterns

**Parsing Capabilities:**

```go
// Function extraction
func GetUser(userID string) (*User, error) {
    return db.Query(userID)
}

// Struct extraction
type User struct {
    ID    string
    Name  string
    Email string
}

// Method extraction
func (u *User) Save() error {
    return db.Insert(u)
}

// Interfaces
type Repository interface {
    Get(id string) (*User, error)
    Save(user *User) error
}

// Goroutines
func ProcessUsers(users []User) {
    ch := make(chan User, len(users))
    for _, user := range users {
        go func(u User) {
            ch <- u
        }(user)
    }
}

// Error handling
func fetchUser(id string) (*User, error) {
    user, err := db.Query(id)
    if err != nil {
        return nil, fmt.Errorf("fetch user: %w", err)
    }
    return user, nil
}
```

**Chunking Strategy:**
- **Primary:** Function/method-level chunking
- **Structs:** Methods chunked individually
- **Interfaces:** Treated as contracts
- **Goroutines:** Included in parent function

**Go-Specific Considerations:**
- **Package structure:** Extracted from `package` declaration
- **Imports:** Both single and grouped forms tracked
- **Error handling:** Pattern recognized but not deeply analyzed
- **Goroutines:** Detected but not executed

**Known Limitations:**
- Channel operations not deeply analyzed
- Some complex type assertions may be simplified
- Build tags not processed

---

### Java

**Status:** ✅ Stable
**Grammar:** tree-sitter-java
**Extensions:** `.java`

**Features:**
- Java 17+ syntax
- Classes and interfaces
- Enums and records
- Generics
- Annotations
- Lambda expressions
- Streams API

**Parsing Capabilities:**

```java
// Class extraction
public class UserService {
    private final Database db;

    @Inject
    public UserService(Database db) {
        this.db = db;
    }

    public Optional<User> getUser(String id) {
        return db.query(id);
    }
}

// Interface extraction
public interface Repository<T, ID> {
    Optional<T> findById(ID id);
    T save(T entity);
}

// Enum extraction
public enum Status {
    ACTIVE, INACTIVE, PENDING;

    public boolean isActive() {
        return this == ACTIVE;
    }
}

// Record extraction (Java 14+)
public record User(String id, String name, String email) {}

// Lambda expressions
list.stream()
    .filter(u -> u.isActive())
    .map(User::getName)
    .collect(Collectors.toList());

// Annotations
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}
```

**Chunking Strategy:**
- **Primary:** Method-level chunking
- **Classes:** Methods chunked individually
- **Interfaces:** Method signatures extracted
- **Annotations:** Extracted as metadata

**Java-Specific Considerations:**
- **Package structure:** Extracted from `package` declaration
- **Imports:** Both `import x` and `import x.*` tracked
- **Annotations:** Extracted with retention policy
- **Generics:** Type parameters tracked

**Known Limitations:**
- Some complex generic wildcards may be simplified
- Annotation processors not executed
- Build-time code generation not analyzed

---

## Adding New Languages

### Step 1: Install Tree-sitter Grammar

```bash
cd prism-indexer
cargo add tree-sitter-cpp
cargo add tree-sitter-ruby
cargo add tree-sitter-php
```

### Step 2: Update Parser

Edit `prism-indexer/src/parser.rs`:

```rust
pub fn new(language: &str) -> Result<PrismParser> {
    let mut parser = Parser::new();

    let language_obj = match language {
        "typescript" => tree_sitter_typescript::language_typescript(),
        "javascript" => tree_sitter_javascript::language_javascript(),
        "python" => tree_sitter_python::language_python(),
        "rust" => tree_sitter_rust::language_rust(),
        "go" => tree_sitter_go::language_go(),
        "java" => tree_sitter_java::language_java(),
        "cpp" => tree_sitter_cpp::language_cpp(),  // New!
        "ruby" => tree_sitter_ruby::language_ruby(),  // New!
        "php" => tree_sitter_php::language_php(),  // New!
        _ => return Err(PrismError::UnsupportedLanguage(language.to_string())),
    };

    // ... rest of function
}
```

### Step 3: Add Language Adapter

Create `prism-indexer/src/languages/cpp.rs`:

```rust
use crate::types::{FunctionInfo, ClassInfo};
use tree_sitter::Node;

/// C++ specific extraction logic
pub fn extract_cpp_function(node: &Node, source: &str) -> Option<FunctionInfo> {
    // C++ has different node types
    match node.kind() {
        "function_definition" => {
            // Extract function name, parameters, etc.
            // ...
        }
        _ => None,
    }
}

pub fn extract_cpp_class(node: &Node, source: &str) -> Option<ClassInfo> {
    // C++ class extraction
    // ...
}
```

### Step 4: Update Extractor

Edit `prism-indexer/src/extractor.rs`:

```rust
pub fn extract_functions(root: &Node, source: &str) -> Vec<FunctionInfo> {
    let language = std::env::var("PRISM_LANGUAGE").unwrap_or_default();

    match language.as_str() {
        "cpp" => languages::cpp::extract_cpp_function(root, source),
        "ruby" => languages::ruby::extract_ruby_function(root, source),
        // ... other languages
        _ => default_extract_function(root, source),
    }
}
```

### Step 5: Update Chunker

Edit `prism-indexer/src/chunker.rs`:

```rust
pub fn chunk_code(root: &Node, source: &str, language: &str) -> Vec<CodeChunk> {
    match language {
        "cpp" => chunk_cpp_code(root, source),  // Custom C++ chunking
        "ruby" => chunk_ruby_code(root, source),  // Custom Ruby chunking
        // ... other languages
        _ => default_chunking(root, source, language),
    }
}
```

### Step 6: Rebuild WASM

```bash
cd prism-indexer
wasm-pack build --target web --release
```

### Step 7: Update TypeScript Types

Edit `src/core/types.ts`:

```typescript
export const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'java',
  'cpp',      // New!
  'ruby',     // New!
  'php',      // New!
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
```

### Step 8: Test

```bash
# Test with sample file
prism index test.cpp --verbose

# Verify parsing works
prism index --include-patterns "**/*.cpp"
```

---

## Language-Specific Chunking

### TypeScript/JavaScript

**Default Chunk Size:** 512 tokens
**Overlap:** 128 tokens

**Strategy:**
```typescript
// Chunk by function
function myFunction() { /* ... */ }  // Chunk boundary

// Chunk React components
function MyComponent() { /* ... */ }  // Chunk boundary

// Chunk class methods
class MyClass {
  method1() { /* ... */ }  // Chunk boundary
  method2() { /* ... */ }  // Chunk boundary
}
```

### Python

**Default Chunk Size:** 512 tokens
**Overlap:** 128 tokens

**Strategy:**
```python
# Chunk by function
def my_function():  # Chunk boundary
    pass

# Chunk by method
class MyClass:
    def method1(self):  # Chunk boundary
        pass

    def method2(self):  # Chunk boundary
        pass

# Chunk by top-level statement
MY_CONSTANT = "value"  # May start new chunk
```

### Rust

**Default Chunk Size:** 512 tokens
**Overlap:** 128 tokens

**Strategy:**
```rust
// Chunk by function
fn my_function() {  // Chunk boundary
}

// Chunk by impl blocks
impl MyClass {
    fn method1(&self) {  // Chunk boundary
    }

    fn method2(&self) {  // Chunk boundary
    }
}
```

### Go

**Default Chunk Size:** 512 tokens
**Overlap:** 128 tokens

**Strategy:**
```go
// Chunk by function
func myFunction() {  // Chunk boundary
}

// Chunk by methods
func (u *User) Method1() {  // Chunk boundary
}

func (u *User) Method2() {  // Chunk boundary
}
```

### Java

**Default Chunk Size:** 512 tokens
**Overlap:** 128 tokens

**Strategy:**
```java
// Chunk by method
public class MyClass {
    public void method1() {  // Chunk boundary
    }

    public void method2() {  // Chunk boundary
    }
}
```

---

## Parsing Quirks

### TypeScript/JavaScript

**JSX Embeddings:**
```typescript
// Embedded SQL in template literals
const query = sql`SELECT * FROM users`;
// Prism parses both JS and SQL separately
```

**Type Assertions:**
```typescript
// Type assertions are preserved
const value = something as string;
```

**Decorators:**
```typescript
// Decorators are extracted but not deeply analyzed
@injectable()
class UserService { }
```

### Python

**Indentation:**
```python
# Tree-sitter handles indentation natively
def my_function():
    if True:
        return "indented correctly"
```

**Type Hints:**
```python
# Type hints are preserved
def fetch_user(id: str) -> Optional[User]:
    return db.get(id)
```

**F-strings:**
```python
# F-strings are parsed correctly
greeting = f"Hello, {name}!"
```

### Rust

**Macros:**
```rust
// Macros are parsed structurally (not expanded)
println!("Hello, {}!", name);
vec![1, 2, 3];  // vec! macro
```

**Lifetimes:**
```rust
// Lifetimes are preserved in signatures
fn fetch<'a>(id: &'a str) -> &'a User { }
```

**Pattern Matching:**
```rust
// Pattern matching is parsed correctly
match value {
    Some(x) => x,
    None => 0,
}
```

### Go

**Goroutines:**
```go
// Goroutines are detected but not executed
go func() {
    fmt.Println("async")
}()
```

**Channels:**
```go
// Channel operations are recognized
ch <- value     // Send
value := <-ch   // Receive
```

### Java

**Annotations:**
```java
// Annotations are extracted as metadata
@Entity
@Table(name = "users")
public class User { }
```

**Generics:**
```java
// Generics are tracked
List<String> names = new ArrayList<>();
```

**Lambdas:**
```java
// Lambdas are parsed correctly
list.stream().filter(u -> u.isActive())
```

---

## Known Limitations

### Cross-Language Issues

1. **Type System Differences**
   - TypeScript's structural typing vs Java's nominal typing
   - Python's dynamic typing not deeply analyzed
   - Rust's ownership system not modeled

2. **Macro Systems**
   - Rust macros: Parsed but not expanded
   - TypeScript decorators: Extracted but not executed
   - Python decorators: Recognized but not run

3. **Metaprogramming**
   - Code generation not analyzed
   - Build-time transformations not processed
   - Runtime code execution not supported

### Per-Language Limitations

**TypeScript:**
- Does not execute type checking
- Some advanced types (conditional types) simplified
- Module resolution not performed

**Python:**
- Dynamic typing not modeled
- Metaclasses not deeply analyzed
- Some magic methods not extracted

**Rust:**
- Procedural macros not expanded
- Const generics partially supported
- Some complex trait bounds simplified

**Go:**
- Channel operations not deeply analyzed
- Some type assertions simplified
- Build tags not processed

**Java:**
- Annotation processors not executed
- Some complex generic wildcards simplified
- Build-time code generation not analyzed

---

## Best Practices

### For Mixed-Language Repositories

1. **Use separate include patterns**
   ```bash
   prism index \
     --include-patterns "**/*.ts,**/*.tsx" \
     --include-patterns "**/*.py"
   ```

2. **Index different directories separately**
   ```bash
   prism index frontend/  # TypeScript
   prism index backend/   # Python
   ```

3. **Use project-specific configs**
   ```json
   // frontend/.prismrc.json
   { "indexer": { "chunkSize": 512 } }

   // backend/.prismrc.json
   { "indexer": { "chunkSize": 1024 } }
   ```

### For Language-Specific Features

1. **Preserve type information** (TypeScript, Rust, Java)
   - Helps with code search relevance
   - Improves retrieval accuracy

2. **Include docstrings** (Python, Java)
   - Provides context for chunks
   - Better semantic understanding

3. **Track imports** (All languages)
   - Helps with dependency analysis
   - Improves code graph construction

---

## Next Steps

- **Learn performance tuning**: [Performance Guide](../guide/05-performance.md)
- **Understand architecture**: [Indexer Architecture](../architecture/04-indexer-architecture.md)
- **Report issues**: [GitHub Issues](https://github.com/prism/prism/issues)

---

**Need Help Adding a Language?**
- Check [Tree-sitter Grammars](https://github.com/tree-sitter)
- Review [Language Implementation Guide](../architecture/04-indexer-architecture.md)
- Join [Discord](https://discord.gg/prism) for help
