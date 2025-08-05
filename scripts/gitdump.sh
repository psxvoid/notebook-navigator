#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to project root directory
cd "$SCRIPT_DIR/.."

# Get timestamp in format YYYYMMDD-HHMMSS
timestamp=$(date +"%Y%m%d-%H%M%S")

# Get current directory name only (not full path)
folder_name=$(basename "$PWD")

# Show selection menu
echo "Choose diff type:"
echo "1) Uncommitted changes (staged and unstaged)"
echo "2) Current branch vs main branch"
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        # Set output path in parent folder
        output_file="../${folder_name}_uncommitted_${timestamp}.txt"
        
        # Write diffs to the file
        echo "Unstaged changes:" > "$output_file"
        git diff --patch --minimal >> "$output_file"
        
        echo "" >> "$output_file"
        echo "Staged (but not yet committed) changes:" >> "$output_file"
        git diff --cached --patch --minimal >> "$output_file"
        ;;
    2)
        # Set output path in parent folder
        output_file="../${folder_name}_vs_main_${timestamp}.txt"
        
        # Get current branch name
        current_branch=$(git branch --show-current)
        
        # Write diff to the file
        echo "Diff between '$current_branch' and 'main' branch:" > "$output_file"
        git diff main..HEAD --patch --minimal >> "$output_file"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo "All diffs saved to $output_file"