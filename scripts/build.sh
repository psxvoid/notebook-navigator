#!/bin/bash

# Main build script for notebook-navigator
# This script is checked into git

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to project root directory
cd "$SCRIPT_DIR/.."

# Track overall status
BUILD_WARNINGS=0
BUILD_ERRORS=0

# Step 1: Run ESLint
echo "Running ESLint..."
ESLINT_OUTPUT=$(npm run lint 2>&1)
ESLINT_STATUS=$?
echo "$ESLINT_OUTPUT"

# Count ESLint errors and warnings from the summary line
ESLINT_SUMMARY=$(echo "$ESLINT_OUTPUT" | grep "✖" | grep "problem")
if [ -n "$ESLINT_SUMMARY" ]; then
    # Extract error count
    ESLINT_ERROR_COUNT=$(echo "$ESLINT_SUMMARY" | sed -n 's/.*(\([0-9]*\) error.*/\1/p')
    if [ -z "$ESLINT_ERROR_COUNT" ]; then
        ESLINT_ERROR_COUNT=0
    fi
    
    # Extract warning count
    ESLINT_WARNING_COUNT=$(echo "$ESLINT_SUMMARY" | sed -n 's/.* \([0-9]*\) warning.*/\1/p')
    if [ -z "$ESLINT_WARNING_COUNT" ]; then
        ESLINT_WARNING_COUNT=0
    fi
    
    if [ $ESLINT_ERROR_COUNT -gt 0 ]; then
        echo "❌ ESLint found $ESLINT_ERROR_COUNT errors"
        BUILD_ERRORS=$((BUILD_ERRORS + 1))
    elif [ $ESLINT_WARNING_COUNT -gt 0 ]; then
        echo "⚠️  ESLint found $ESLINT_WARNING_COUNT warnings"
        BUILD_WARNINGS=$((BUILD_WARNINGS + 1))
    fi
else
    echo "✅ ESLint passed"
fi

# Step 2: Run TypeScript type checking
echo -e "\nChecking TypeScript types..."
npx tsc --noEmit --skipLibCheck
TSC_STATUS=$?
if [ $TSC_STATUS -ne 0 ]; then
    echo "❌ TypeScript type checking failed"
    BUILD_ERRORS=$((BUILD_ERRORS + 1))
else
    echo "✅ TypeScript types are valid"
    
    # Check for unused imports and variables (warning only)
    echo "Checking for unused imports..."
    UNUSED_COUNT=$(npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 | grep -c "is declared but\|is defined but")
    if [ $UNUSED_COUNT -gt 0 ]; then
        echo "⚠️  Warning: Found $UNUSED_COUNT unused imports or variables"
        echo "Run 'npx tsc --noEmit --noUnusedLocals --noUnusedParameters' to see details"
        BUILD_WARNINGS=$((BUILD_WARNINGS + 1))
    else
        echo "✅ No unused imports found"
    fi
fi

# Step 3: Check for dead code with Knip (warning only)
echo -e "\nChecking for dead code..."
KNIP_OUTPUT=$(npx knip --no-progress 2>/dev/null)
DEAD_FILES=$(echo "$KNIP_OUTPUT" | grep -c "^src/.*\.(ts|tsx)" || true)
DEAD_EXPORTS=$(echo "$KNIP_OUTPUT" | grep -c "function\|class\|interface\|type\|const" || true)

if [ $DEAD_FILES -gt 0 ] || [ $DEAD_EXPORTS -gt 0 ]; then
    echo "⚠️  Warning: Found dead code - $DEAD_FILES unused files, $DEAD_EXPORTS unused exports"
    echo "Run 'npx knip' to see details"
    BUILD_WARNINGS=$((BUILD_WARNINGS + 1))
else
    echo "✅ No dead code found"
fi

# Step 4: Fix formatting with Prettier
echo -e "\nChecking code formatting..."
# Run prettier and capture output
PRETTIER_OUTPUT=$(npm run format 2>&1)
PRETTIER_STATUS=$?

if [ $PRETTIER_STATUS -ne 0 ]; then
    echo "❌ Failed to fix code formatting"
    echo "$PRETTIER_OUTPUT"
    BUILD_ERRORS=$((BUILD_ERRORS + 1))
else
    # Check if any files were changed
    if echo "$PRETTIER_OUTPUT" | grep -q "(unchanged)"; then
        # Count changed vs unchanged files
        CHANGED_COUNT=$(echo "$PRETTIER_OUTPUT" | grep -v "(unchanged)" | grep -E "\.(ts|tsx|js|jsx|json|md|css).*[0-9]+ms$" | wc -l | tr -d ' ')
        UNCHANGED_COUNT=$(echo "$PRETTIER_OUTPUT" | grep -c "(unchanged)" || true)
        
        if [ $CHANGED_COUNT -eq 0 ]; then
            echo "✅ Code formatting is already correct (all $UNCHANGED_COUNT files unchanged)"
        else
            echo "✅ Code formatting fixed ($CHANGED_COUNT files updated, $UNCHANGED_COUNT unchanged)"
        fi
    else
        # Old prettier version or different output format
        echo "✅ Code formatting complete"
    fi
fi

# Step 5: Run unit tests
echo -e "\nRunning unit tests..."
TEST_OUTPUT=$(npm run test 2>&1)
TEST_STATUS=$?
echo "$TEST_OUTPUT"

if [ $TEST_STATUS -ne 0 ]; then
    echo "❌ Unit tests failed"
    BUILD_ERRORS=$((BUILD_ERRORS + 1))
else
    echo "✅ Unit tests passed"
fi

# Only run the build if there are zero errors AND zero warnings
if [ $BUILD_ERRORS -eq 0 ] && [ $BUILD_WARNINGS -eq 0 ]; then
    # Run the standard npm build
    echo -e "\nBuilding notebook-navigator..."
    npm run build
    
    # Check if build was successful
    if [ $? -eq 0 ]; then
        echo "✅ Build completed successfully"
        
        # Check if local post-build script exists and run it
        if [ -f "$SCRIPT_DIR/build-local.sh" ]; then
            echo "Running local post-build script..."
            "$SCRIPT_DIR/build-local.sh"
        fi
        
        # Summary
        echo -e "\n=== Build Summary ==="
        echo "✅ Build successful"
        echo "✅ No warnings"
    else
        echo "❌ Build failed"
        exit 1
    fi
else
    echo -e "\n=== Build Summary ==="
    if [ $BUILD_ERRORS -gt 0 ] && [ $BUILD_WARNINGS -gt 0 ]; then
        echo "❌ Build aborted due to $BUILD_ERRORS error(s) and $BUILD_WARNINGS warning(s)"
    elif [ $BUILD_ERRORS -gt 0 ]; then
        echo "❌ Build aborted due to $BUILD_ERRORS error(s)"
    else
        echo "❌ Build aborted due to $BUILD_WARNINGS warning(s)"
    fi
    exit 1
fi

# Step 6: Update README with documentation from website
echo -e "\nUpdating README with latest documentation..."

# Fetch documentation from production website
DOCS_URL="https://notebooknavigator.com/docs/en/content.md"

echo "Fetching documentation from website..."

# Use curl to fetch the documentation
HTTP_STATUS=$(curl -s -o /tmp/docs-content.md -w "%{http_code}" "$DOCS_URL")

if [ "$HTTP_STATUS" = "200" ]; then
    # Extract intro section (everything before the marker)
    sed -n '/<!-- DOCUMENTATION_START -->/q;p' README.md > /tmp/readme-intro.md

    # Append the marker
    echo "<!-- DOCUMENTATION_START -->" >> /tmp/readme-intro.md
    echo "" >> /tmp/readme-intro.md

    # Append the fetched documentation
    cat /tmp/docs-content.md >> /tmp/readme-intro.md

    # Replace README with combined content
    cp /tmp/readme-intro.md README.md
    echo "✅ README updated with documentation from website"
else
    echo "⚠️  Warning: Could not fetch documentation (HTTP $HTTP_STATUS). README not updated."
    echo "   Documentation should be available at: $DOCS_URL"
fi
