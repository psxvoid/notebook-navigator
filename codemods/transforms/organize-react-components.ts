import { Transform } from 'jscodeshift';

const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    // Skip if no React imports
    const hasReact = root.find(j.ImportDeclaration).some(path => {
        const source = path.node.source.value;
        return typeof source === 'string' && (source === 'react' || source.startsWith('react/'));
    });

    if (!hasReact) {
        return null;
    }

    // Find the program body
    const programBody = root.find(j.Program).get('body');
    const statements = programBody.value;

    // Categorize statements
    const categorized = {
        imports: [] as any[],
        typeDefinitions: [] as any[],
        constants: [] as any[],
        utils: [] as any[],
        customHooks: [] as any[],
        components: [] as any[],
        defaultExport: null as any,
        other: [] as any[]
    };

    // Helper to check if a function is a React component
    const isReactComponent = (name: string) => {
        return /^[A-Z]/.test(name);
    };

    // Helper to check if a function is a custom hook
    const isCustomHook = (name: string) => {
        return name.startsWith('use') && /^use[A-Z]/.test(name);
    };

    // Helper to check if identifier is exported
    const isExported = (node: any) => {
        return (
            node.type === 'ExportNamedDeclaration' ||
            node.type === 'ExportDefaultDeclaration' ||
            (node.declaration && node.declaration.type === 'VariableDeclaration')
        );
    };

    statements.forEach((statement: any) => {
        // Handle imports
        if (j.ImportDeclaration.check(statement)) {
            categorized.imports.push(statement);
            return;
        }

        // Handle type definitions
        if (
            j.TSTypeAliasDeclaration.check(statement) ||
            j.TSInterfaceDeclaration.check(statement) ||
            (j.ExportNamedDeclaration.check(statement) &&
                (j.TSTypeAliasDeclaration.check(statement.declaration) || j.TSInterfaceDeclaration.check(statement.declaration)))
        ) {
            categorized.typeDefinitions.push(statement);
            return;
        }

        // Handle default export
        if (j.ExportDefaultDeclaration.check(statement)) {
            categorized.defaultExport = statement;
            return;
        }

        // Handle function declarations
        if (j.FunctionDeclaration.check(statement)) {
            const name = statement.id?.name || '';
            if (isReactComponent(name)) {
                categorized.components.push(statement);
            } else if (isCustomHook(name)) {
                categorized.customHooks.push(statement);
            } else {
                categorized.utils.push(statement);
            }
            return;
        }

        // Handle exported function declarations
        if (j.ExportNamedDeclaration.check(statement) && j.FunctionDeclaration.check(statement.declaration)) {
            const name = statement.declaration.id?.name || '';
            if (isReactComponent(name)) {
                categorized.components.push(statement);
            } else if (isCustomHook(name)) {
                categorized.customHooks.push(statement);
            } else {
                categorized.utils.push(statement);
            }
            return;
        }

        // Handle variable declarations (const/let/var)
        if (
            j.VariableDeclaration.check(statement) ||
            (j.ExportNamedDeclaration.check(statement) && j.VariableDeclaration.check(statement.declaration))
        ) {
            const decl = j.VariableDeclaration.check(statement) ? statement : statement.declaration;
            const firstDeclarator = decl.declarations[0];

            if (firstDeclarator && j.Identifier.check(firstDeclarator.id)) {
                const name = firstDeclarator.id.name;
                const init = firstDeclarator.init;

                // Check for React components (arrow functions or function expressions)
                if (
                    isReactComponent(name) &&
                    (j.ArrowFunctionExpression.check(init) ||
                        j.FunctionExpression.check(init) ||
                        (j.CallExpression.check(init) && ['memo', 'forwardRef'].includes((init.callee as any).name)))
                ) {
                    categorized.components.push(statement);
                    return;
                }

                // Check for custom hooks
                if (isCustomHook(name) && (j.ArrowFunctionExpression.check(init) || j.FunctionExpression.check(init))) {
                    categorized.customHooks.push(statement);
                    return;
                }

                // Constants (typically uppercase or configuration objects)
                if (/^[A-Z_]+$/.test(name) || j.ObjectExpression.check(init) || j.ArrayExpression.check(init) || j.Literal.check(init)) {
                    categorized.constants.push(statement);
                    return;
                }

                // Other functions are utils
                if (j.ArrowFunctionExpression.check(init) || j.FunctionExpression.check(init)) {
                    categorized.utils.push(statement);
                    return;
                }
            }
        }

        // Everything else
        categorized.other.push(statement);
    });

    // Sort components and hooks by name
    const sortByName = (items: any[]) => {
        return items.sort((a, b) => {
            const aName = getName(a);
            const bName = getName(b);
            return aName.localeCompare(bName);
        });
    };

    const getName = (node: any): string => {
        if (node.id?.name) return node.id.name;
        if (node.declaration?.id?.name) return node.declaration.id.name;
        if (node.declaration?.declarations?.[0]?.id?.name) {
            return node.declaration.declarations[0].id.name;
        }
        if (node.declarations?.[0]?.id?.name) {
            return node.declarations[0].id.name;
        }
        return '';
    };

    // Build reorganized program
    const organized: any[] = [];

    // Imports stay at top (already handled by organize-imports)
    organized.push(...categorized.imports);

    // Type definitions
    if (categorized.typeDefinitions.length > 0) {
        if (organized.length > 0) organized.push(j.noop());
        organized.push(...sortByName(categorized.typeDefinitions));
    }

    // Constants
    if (categorized.constants.length > 0) {
        if (organized.length > 0) organized.push(j.noop());
        organized.push(...sortByName(categorized.constants));
    }

    // Utility functions
    if (categorized.utils.length > 0) {
        if (organized.length > 0) organized.push(j.noop());
        organized.push(...sortByName(categorized.utils));
    }

    // Custom hooks
    if (categorized.customHooks.length > 0) {
        if (organized.length > 0) organized.push(j.noop());
        organized.push(...sortByName(categorized.customHooks));
    }

    // Components
    if (categorized.components.length > 0) {
        if (organized.length > 0) organized.push(j.noop());
        organized.push(...sortByName(categorized.components));
    }

    // Other statements
    if (categorized.other.length > 0) {
        if (organized.length > 0) organized.push(j.noop());
        organized.push(...categorized.other);
    }

    // Default export at the end
    if (categorized.defaultExport) {
        if (organized.length > 0) organized.push(j.noop());
        organized.push(categorized.defaultExport);
    }

    // Replace program body
    programBody.value = organized.filter(item => item !== null);

    return root.toSource({ quote: 'single', trailingComma: true });
};

export default transform;
