#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('Testing dependency-aware transformations...\n');

const testFile = join(__dirname, 'test-fixtures/dependency-test.tsx');
const transformPath = join(__dirname, 'transforms/organize-react-components.ts');

// Run the transform
console.log('Running organize-react-components transform...');
try {
    execSync(`npx jscodeshift -t ${transformPath} ${testFile} --dry --print`, {
        stdio: 'inherit'
    });
} catch (error) {
    console.error('Error running transform:', error);
}

console.log('\n\nNow testing organize-react-internals transform...');
const internalsTransformPath = join(__dirname, 'transforms/organize-react-internals.ts');

try {
    execSync(`npx jscodeshift -t ${internalsTransformPath} ${testFile} --dry --print`, {
        stdio: 'inherit'
    });
} catch (error) {
    console.error('Error running transform:', error);
}

console.log('\n\nTest complete! Check the output above to verify dependencies are preserved.');
