#!/bin/bash

###############################################################################
# Ollama Setup Script for PRISM
#
# This script installs and configures Ollama for local LLM inference.
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Main script
print_header "Setting up Ollama for PRISM"

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    MINGW*|MSYS*|CYGWIN*)    MACHINE=Windows;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

print_info "Detected OS: ${MACHINE}"

# Check if Ollama is installed
if command -v ollama &> /dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>&1 || echo "unknown")
    print_success "Ollama is already installed (version: ${OLLAMA_VERSION})"
else
    print_info "Ollama is not installed. Installing..."

    case "${MACHINE}" in
        Linux*)
            print_info "Installing Ollama on Linux..."
            curl -fsSL https://ollama.com/install.sh | sh
            ;;
        Mac*)
            print_info "Installing Ollama on Mac..."
            if command -v brew &> /dev/null; then
                brew install ollama
            else
                print_error "Homebrew not found. Please install Homebrew first:"
                echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
                exit 1
            fi
            ;;
        Windows*)
            print_error "Please install Ollama manually on Windows:"
            echo "  1. Download from: https://ollama.com/download"
            echo "  2. Run the installer"
            echo "  3. Restart your terminal"
            exit 1
            ;;
        *)
            print_error "Unsupported OS: ${MACHINE}"
            exit 1
            ;;
    esac

    # Verify installation
    if command -v ollama &> /dev/null; then
        print_success "Ollama installed successfully"
    else
        print_error "Ollama installation failed"
        exit 1
    fi
fi

# Check if Ollama is running
print_info "Checking if Ollama is running..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    print_success "Ollama is running"
else
    print_warning "Ollama is not running. Starting it..."

    case "${MACHINE}" in
        Linux*)
            if command -v systemctl &> /dev/null; then
                sudo systemctl start ollama
            else
                # Start ollama in background
                nohup ollama serve > /dev/null 2>&1 &
                sleep 3
            fi
            ;;
        Mac*)
            # On Mac, Ollama should be started by the user
            print_info "Please start Ollama manually:"
            echo "  1. Open the Ollama application"
            echo "  2. Or run: ollama serve"
            ;;
        Windows*)
            print_info "Please start Ollama manually from the Start menu"
            ;;
    esac

    # Wait for Ollama to start
    print_info "Waiting for Ollama to start..."
    for i in {1..10}; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            print_success "Ollama is now running"
            break
        fi
        if [ $i -eq 10 ]; then
            print_warning "Ollama might not be running. Please start it manually."
        fi
        sleep 1
    done
fi

# Pull recommended models
print_header "Pulling Recommended Models"

# Recommended models for PRISM
MODELS=(
    "deepseek-coder-v2:latest"      # Code generation and completion
    "nomic-embed-text:latest"       # Embeddings for vector search
    "llama3.1:latest"               # General chat and reasoning
    "qwen2.5-coder:latest"          # Alternative code model
)

for model in "${MODELS[@]}"; do
    print_info "Pulling ${model}..."
    if ollama pull "${model}"; then
        print_success "Pulled ${model}"
    else
        print_warning "Failed to pull ${model}. You can pull it later with: ollama pull ${model}"
    fi
done

# List available models
print_header "Available Models"
ollama list

# Test Ollama
print_header "Testing Ollama"
print_info "Running test generation..."

if ollama run deepseek-coder-v2 "console.log('Hello, World!');" > /dev/null 2>&1; then
    print_success "Ollama is working correctly"
else
    print_warning "Ollama test failed. You may need to configure it manually."
fi

# Print summary
print_header "Setup Complete!"
echo ""
print_success "Ollama is ready to use with PRISM"
echo ""
print_info "Available models:"
ollama list 2>/dev/null || echo "  Run 'ollama list' to see available models"
echo ""
print_info "Next steps:"
echo "  1. Start Ollama (if not running): ollama serve"
echo "  2. Pull more models (optional): ollama pull <model-name>"
echo "  3. Use PRISM to index your codebase"
echo ""
print_info "Popular models:"
echo "  • deepseek-coder-v2     - Code generation"
echo "  • nomic-embed-text      - Embeddings"
echo "  • llama3.1              - General chat"
echo "  • qwen2.5-coder         - Alternative code model"
echo "  • mixtral               - Advanced reasoning"
echo ""
print_info "For more models, visit: https://ollama.com/library"
echo ""
