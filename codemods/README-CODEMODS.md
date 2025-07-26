# Codemods for Notebook Navigator

This directory contains jscodeshift codemods to help maintain code quality and
consistency across the TypeScript/React codebase.

## Available Codemods

### 1. organize-imports.js

Organizes and sorts import statements according to our conventions:

- React imports first
- Obsidian imports
- Third-party libraries
- Internal imports
- Relative imports
- Type imports last

### 2. cleanup-react-components.js

Cleans up React component patterns:

- Converts `React.FC` to explicit return type annotations
- Ensures consistent prop destructuring
- Removes unnecessary React imports (if using new JSX transform)
- Standardizes component definitions

### 3. standardize-code-style.js

Enforces consistent code style:

- Converts `==` to `===` and `!=` to `!==`
- Removes unnecessary `else` after `return`
- Uses optional chaining where appropriate
- Converts string concatenation to template literals
- Changes `let` to `const` for never-reassigned variables

## Running Codemods

### Quick Start

```bash
# Run all codemods with interactive prompts
./scripts/run-codemods.sh
```

### Individual Codemods

```bash
# Dry run (see what would change)
npx jscodeshift -t ./codemods/organize-imports.js --parser tsx --extensions ts,tsx --dry src/

# Apply changes
npx jscodeshift -t ./codemods/organize-imports.js --parser tsx --extensions ts,tsx src/
```

### Options

- `--dry`: Show what would be changed without modifying files
- `--print`: Print transformed files to stdout
- `--silent`: Suppress output

## Configuration

Edit `.jscodeshift.config.js` to customize:

- Import order preferences
- Code style settings
- File patterns to include/exclude

## Creating New Codemods

1. Create a new file in `codemods/` directory
2. Export a transformer function:

```javascript
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Your transformations here

  return root.toSource();
};
```

3. Test with dry run before applying

## Safety

The `run-codemods.sh` script automatically:

- Creates a git stash backup before running
- Shows dry run results before applying
- Asks for confirmation before each transform
- Runs prettier and eslint after transformations
