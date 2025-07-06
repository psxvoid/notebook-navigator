#!/bin/bash

# Main build script for notebook-navigator
# This script is checked into git

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to project root directory
cd "$SCRIPT_DIR/.."

# Run the standard npm build
echo "Building notebook-navigator..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
    
    # Check if local post-build script exists and run it
    if [ -f "$SCRIPT_DIR/build-local.sh" ]; then
        echo "Running local post-build script..."
        "$SCRIPT_DIR/build-local.sh"
    fi
else
    echo "❌ Build failed"
    exit 1
fi