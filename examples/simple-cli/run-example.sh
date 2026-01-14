#!/bin/bash

# PRISM Simple CLI Example
# This script demonstrates basic PRISM usage

set -e  # Exit on error

echo "==================================="
echo "PRISM Simple CLI Example"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PRISM is installed
echo -e "${BLUE}Checking if PRISM is installed...${NC}"
if ! command -v prism &> /dev/null; then
    echo -e "${YELLOW}PRISM is not installed. Installing...${NC}"
    npm install -g @claudes-friend/prism
else
    echo -e "${GREEN}✓ PRISM is installed${NC}"
fi
echo ""

# Step 1: Index the sample code
echo -e "${BLUE}Step 1: Indexing the sample codebase...${NC}"
prism index ./sample-code
echo ""
echo -e "${GREEN}✓ Indexing complete!${NC}"
echo ""

# Wait a moment
sleep 2

# Step 2: Perform searches
echo -e "${BLUE}Step 2: Performing semantic searches...${NC}"
echo ""

echo -e "${YELLOW}Search 1: How do users log in?${NC}"
prism search "how do users log in?"
echo ""
echo "Press Enter to continue..."
read

echo -e "${YELLOW}Search 2: Database connection${NC}"
prism search "database connection"
echo ""
echo "Press Enter to continue..."
read

echo -e "${YELLOW}Search 3: API endpoints${NC}"
prism search "API endpoints"
echo ""

# Wait a moment
sleep 2

# Step 3: Ask a question (if API key available)
echo -e "${BLUE}Step 3: Asking a question about the code...${NC}"
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo -e "${YELLOW}Question: How does authentication work?${NC}"
    prism chat "How does the authentication system work?"
else
    echo -e "${YELLOW}Skipping chat (no ANTHROPIC_API_KEY set)${NC}"
    echo "To use chat, set your API key:"
    echo "  export ANTHROPIC_API_KEY=your-key-here"
fi
echo ""

# Wait a moment
sleep 2

# Step 4: Show statistics
echo -e "${BLUE}Step 4: Usage statistics${NC}"
prism stats
echo ""

# Done!
echo -e "${GREEN}==================================="
echo "Example complete!"
echo "===================================${NC}"
echo ""
echo "Try these commands to experiment:"
echo "  prism search 'error handling'"
echo "  prism search 'input validation'"
echo "  prism search 'HTTP endpoints'"
echo ""
echo "To clean up:"
echo "  rm -rf .prism/"
echo ""
