/**
 * Codemod to organize and sort imports in TypeScript/React files
 */

const config = require('../.jscodeshift.config');

module.exports = function transformer(fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    const importOrder = config.options.importOrder;

    // Collect all import declarations
    const imports = [];
    root.find(j.ImportDeclaration).forEach(path => {
        imports.push(path);
        j(path).remove();
    });

    // Sort imports according to our order
    imports.sort((a, b) => {
        const aSource = a.value.source.value;
        const bSource = b.value.source.value;

        const aIndex = getImportOrderIndex(aSource, importOrder);
        const bIndex = getImportOrderIndex(bSource, importOrder);

        if (aIndex !== bIndex) {
            return aIndex - bIndex;
        }

        // If same category, sort alphabetically
        return aSource.localeCompare(bSource);
    });

    // Group imports by category
    const importsByCategory = new Map();

    imports.forEach(importPath => {
        const source = importPath.value.source.value;
        const category = getImportOrderIndex(source, importOrder);

        if (!importsByCategory.has(category)) {
            importsByCategory.set(category, []);
        }
        importsByCategory.get(category).push(importPath.value);
    });

    // Get the program body
    const programBody = root.find(j.Program).get('body').value;

    // Find first non-import statement index
    const firstNonImportIndex = programBody.findIndex(node => node.type !== 'ImportDeclaration');

    // Build new imports with blank lines between categories
    const newImports = [];
    const sortedCategories = Array.from(importsByCategory.keys()).sort((a, b) => a - b);

    sortedCategories.forEach((category, index) => {
        const categoryImports = importsByCategory.get(category);
        newImports.push(...categoryImports);

        // Add blank line after each category except the last
        if (index < sortedCategories.length - 1 && categoryImports.length > 0) {
            // Add an empty line by inserting a noop statement that we'll handle in toSource
            const nextCategory = sortedCategories[index + 1];
            if (importsByCategory.get(nextCategory).length > 0) {
                newImports.push('BLANK_LINE');
            }
        }
    });

    // Replace imports at the beginning of the file
    if (firstNonImportIndex === -1) {
        // All statements are imports
        programBody.length = 0;
        programBody.push(...newImports.filter(imp => imp !== 'BLANK_LINE'));
    } else {
        // Remove old imports and insert new ones
        programBody.splice(0, firstNonImportIndex, ...newImports.filter(imp => imp !== 'BLANK_LINE'));
    }

    // Custom print function to handle blank lines
    const originalToSource = root.toSource.bind(root);
    root.toSource = function (options) {
        let source = originalToSource(options);

        // Post-process to add blank lines between import groups
        const lines = source.split('\n');
        const processedLines = [];
        let lastImportCategory = null;

        lines.forEach(line => {
            if (line.startsWith('import ')) {
                const match = line.match(/from ['"](.+)['"]/);
                if (match) {
                    const source = match[1];
                    const category = getImportOrderIndex(source, importOrder);

                    if (lastImportCategory !== null && lastImportCategory !== category && processedLines.length > 0) {
                        // Add blank line between different categories
                        processedLines.push('');
                    }
                    lastImportCategory = category;
                }
            } else if (!line.startsWith('import ')) {
                lastImportCategory = null;
            }

            processedLines.push(line);
        });

        return processedLines.join('\n');
    };

    return root
        .toSource({
            quote: config.options.quotes === 'single' ? 'single' : 'double',
            tabWidth: config.options.tabWidth,
            useTabs: config.options.useTabs
        })
        .replace(/root\.toSource = function[^}]+};/, '');
};

function getImportOrderIndex(source, importOrder) {
    for (let i = 0; i < importOrder.length; i++) {
        const pattern = importOrder[i];
        if (pattern === '<THIRD_PARTY_MODULES>') {
            // If it doesn't match any other pattern, it's third party
            const isMatched = importOrder.some((p, idx) => idx !== i && p !== '<THIRD_PARTY_MODULES>' && new RegExp(p).test(source));
            if (!isMatched) return i;
        } else if (new RegExp(pattern).test(source)) {
            return i;
        }
    }
    return importOrder.length;
}
