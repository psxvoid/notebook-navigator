# Notebook Navigator Code Transforms

This directory contains jscodeshift transforms to help organize and improve the
codebase.

## Available Transforms

### organize-imports

Organizes and sorts import statements into groups:

1. React imports
2. Obsidian imports
3. Third-party libraries
4. Absolute imports
5. Relative imports
6. Style imports

### sort-class-members

Sorts class members by type and visibility:

1. Static properties
2. Static methods
3. Instance properties
4. Constructor
5. React lifecycle methods (in order)
6. Getters/setters
7. Public methods (alphabetical)
8. Private methods (alphabetical)

## Usage

```bash
# Run all transforms (dry run)
npm run transform:dry

# Run all transforms
npm run transform

# Run specific transform
npm run transform:imports
npm run transform:classes

# Run with custom file pattern
npx tsx codemods/run-transforms.ts organize-imports -- "src/components/**/*.tsx"
```

## Adding New Transforms

1. Create a new transform file in `codemods/transforms/`
2. Add it to the transforms array in `run-transforms.ts`
3. Optionally add a dedicated npm script

Example transform structure:

```typescript
import { Transform } from 'jscodeshift';

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Transform logic here

  return root.toSource({ quote: 'single', trailingComma: true });
};

export default transform;
```
