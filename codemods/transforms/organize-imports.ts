import { Transform, ImportDeclaration } from 'jscodeshift';

const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    // Find all import declarations
    const imports = root.find(j.ImportDeclaration);

    if (imports.length === 0) {
        return null;
    }

    // Categorize imports
    const importGroups = {
        react: [] as ImportDeclaration[],
        thirdParty: [] as ImportDeclaration[],
        obsidian: [] as ImportDeclaration[],
        absolute: [] as ImportDeclaration[],
        relative: [] as ImportDeclaration[],
        styles: [] as ImportDeclaration[]
    };

    imports.forEach(path => {
        const node = path.node;
        const source = node.source.value as string;

        if (source.startsWith('react') || source === 'react') {
            importGroups.react.push(node);
        } else if (source === 'obsidian') {
            importGroups.obsidian.push(node);
        } else if (source.endsWith('.css') || source.endsWith('.scss') || source.endsWith('.less')) {
            importGroups.styles.push(node);
        } else if (source.startsWith('.') || source.startsWith('..')) {
            importGroups.relative.push(node);
        } else if (source.startsWith('@/') || source.startsWith('src/')) {
            importGroups.absolute.push(node);
        } else {
            importGroups.thirdParty.push(node);
        }
    });

    // Sort imports within each group
    const sortImports = (imports: ImportDeclaration[]) => {
        return imports.sort((a, b) => {
            const aSource = a.source.value as string;
            const bSource = b.source.value as string;
            return aSource.localeCompare(bSource);
        });
    };

    // Build organized imports with spacing
    const organizedImports: ImportDeclaration[] = [];

    if (importGroups.react.length > 0) {
        organizedImports.push(...sortImports(importGroups.react));
    }

    if (importGroups.obsidian.length > 0) {
        if (organizedImports.length > 0) organizedImports.push(null as any); // spacing
        organizedImports.push(...sortImports(importGroups.obsidian));
    }

    if (importGroups.thirdParty.length > 0) {
        if (organizedImports.length > 0) organizedImports.push(null as any); // spacing
        organizedImports.push(...sortImports(importGroups.thirdParty));
    }

    if (importGroups.absolute.length > 0) {
        if (organizedImports.length > 0) organizedImports.push(null as any); // spacing
        organizedImports.push(...sortImports(importGroups.absolute));
    }

    if (importGroups.relative.length > 0) {
        if (organizedImports.length > 0) organizedImports.push(null as any); // spacing
        organizedImports.push(...sortImports(importGroups.relative));
    }

    if (importGroups.styles.length > 0) {
        if (organizedImports.length > 0) organizedImports.push(null as any); // spacing
        organizedImports.push(...sortImports(importGroups.styles));
    }

    // Remove existing imports
    imports.remove();

    // Get the first non-import statement
    const firstNonImport = root.find(j.Program).get('body', 0);

    // Insert organized imports
    organizedImports.forEach((imp, index) => {
        if (imp === null) {
            // Add empty line
            return;
        }

        if (index === 0) {
            firstNonImport.insertBefore(imp);
        } else {
            const prevImport = organizedImports[index - 1];
            if (prevImport === null) {
                // Add after empty line
                firstNonImport.insertBefore(imp);
            } else {
                firstNonImport.insertBefore(imp);
            }
        }
    });

    return root.toSource({ quote: 'single', trailingComma: true });
};

export default transform;
