#!/bin/bash

# Script to run jscodeshift codemods on the codebase

set -e

echo "🔧 Running code transformations..."

# Check if jscodeshift is installed locally
if [ ! -f "node_modules/.bin/jscodeshift" ]; then
    echo "❌ jscodeshift is not installed locally. Installing..."
    npm install --save-dev jscodeshift
fi

# Use local jscodeshift
JSCODESHIFT="npx jscodeshift"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run a codemod
run_codemod() {
    local codemod=$1
    local description=$2
    
    echo -e "${YELLOW}Running: ${description}${NC}"
    
    # Dry run first
    echo "  → Dry run..."
    $JSCODESHIFT -t "./codemods/${codemod}" \
        --parser tsx \
        --extensions ts,tsx \
        --dry \
        src/
    
    echo "  → Apply changes? (y/n)"
    read -r response
    
    if [[ "$response" == "y" ]]; then
        $JSCODESHIFT -t "./codemods/${codemod}" \
            --parser tsx \
            --extensions ts,tsx \
            src/
        echo -e "${GREEN}✓ ${description} completed${NC}"
    else
        echo "  → Skipped"
    fi
    
    echo ""
}

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes. Creating backup..."
    git add -A
    git stash push -m "Backup before codemods $(date +%Y%m%d-%H%M%S)"
    echo -e "${GREEN}✓ Backup created${NC}\n"
else
    echo "✓ Working directory is clean\n"
fi

# Run transforms
run_codemod "organize-imports.js" "Organize and sort imports"
run_codemod "cleanup-react-components.js" "Clean up React component patterns"
run_codemod "standardize-code-style.js" "Standardize code style"

# Run prettier if available
if command -v prettier &> /dev/null; then
    echo -e "${YELLOW}Running Prettier...${NC}"
    prettier --write "src/**/*.{ts,tsx}"
    echo -e "${GREEN}✓ Prettier formatting completed${NC}\n"
fi

# Run ESLint fix if available
if command -v eslint &> /dev/null; then
    echo -e "${YELLOW}Running ESLint auto-fix...${NC}"
    eslint --fix "src/**/*.{ts,tsx}" || true
    echo -e "${GREEN}✓ ESLint auto-fix completed${NC}\n"
fi

echo "🎉 Code transformations complete!"
echo ""
echo "Review the changes with:"
echo "  git diff"
echo ""
echo "If you want to revert:"
echo "  git stash pop"