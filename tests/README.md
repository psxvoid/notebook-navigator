# Notebook Navigator Tests

This directory contains test scripts for the Notebook Navigator plugin.

## API Test Suite

The `api-test-suite.js` file contains a comprehensive test suite for the Notebook Navigator API.

### Usage

1. Open Obsidian Developer Console (Ctrl/Cmd + Shift + I)
2. Copy the entire contents of `api-test-suite.js`
3. Paste into the console and press Enter

### Test Options

```javascript
runTests(); // Run all tests with auto-cleanup
runTests({ verbose: true }); // Show detailed output
runTests({ only: 'metadata' }); // Run only specific test suite
runTests({ cleanup: false }); // Keep test files for debugging
```

### Test Categories

- **Version & Compatibility** - API version and feature detection
- **Navigation** - File navigation functionality
- **Metadata** - Folder/tag colors, icons, and pinned files
- **Selection** - Current selection state

### Safety

The test suite only creates temporary files with "test-" prefix at the root of your vault and automatically cleans them
up after completion.
