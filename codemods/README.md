# Notebook Navigator Code Transforms

This directory contains jscodeshift transforms to organize the codebase.
All transforms run Prettier after successfulmodifications.

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
6. Public methods (alphabetical)
7. Private methods (alphabetical)
8. Getters/setters
9. Other members (preserved to ensure no code is lost)

### organize-react-components

Organizes React files by moving declarations into a consistent order:

1. Imports (preserved from organize-imports)
2. Type definitions (interfaces, types)
3. Constants (UPPERCASE, objects, arrays)
4. Utility functions (non-component functions)
5. Custom hooks (useXxx functions)
6. React components (PascalCase functions/consts)
7. Other statements
8. Default export (moved to end)

### organize-react-internals

Organizes the internal structure of React components by reordering hooks,
variables, and functions:

1. Props destructuring and arguments
2. State hooks (useState) and refs (useRef)
3. Memoized values (useMemo)
4. Regular variables and constants
5. Handler functions (handleXxx, onXxx)
6. Helper functions
7. Effects (useEffect)
8. Return statement

This transform helps maintain a consistent structure within React component
bodies.

## Usage

```bash
# Run all transforms (dry run)
npm run transform:dry

# Run all transforms
npm run transform

# Run specific transform
npm run transform:imports
npm run transform:classes
npm run transform:react
npm run transform:react-internals

# Run with custom file pattern
npx tsx codemods/run-transforms.ts organize-imports -- "src/components/**/*.tsx"
```

## Important Notes

- All transforms are designed to **never delete code** - they only reorganize
  existing code
- Transforms automatically run Prettier after successful modifications
- Use `--dry-run` flag to preview changes without modifying files
- Transforms preserve all comments and formatting where possible
- Files are only modified if the transform actually makes changes

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
