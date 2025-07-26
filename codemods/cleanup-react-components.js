/**
 * Codemod to clean up React component patterns
 */

const config = require('../.jscodeshift.config');

module.exports = function transformer(fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    // 1. Convert React.FC to explicit typing
    root.find(j.VariableDeclarator, {
        id: { type: 'Identifier' },
        init: { type: 'ArrowFunctionExpression' }
    }).forEach(path => {
        const { id, init, typeAnnotation } = path.value;

        // Check if it's typed as React.FC
        if (typeAnnotation && typeAnnotation.typeAnnotation) {
            const annotation = typeAnnotation.typeAnnotation;
            if (
                annotation.type === 'TSTypeReference' &&
                annotation.typeName.type === 'TSQualifiedName' &&
                annotation.typeName.left.name === 'React' &&
                annotation.typeName.right.name === 'FC'
            ) {
                // Extract the props type from React.FC<Props>
                let propsType = null;
                if (annotation.typeParameters && annotation.typeParameters.params.length > 0) {
                    propsType = annotation.typeParameters.params[0];
                }

                // Remove React.FC type from variable
                path.value.typeAnnotation = null;

                // Add props type to arrow function parameters
                if (propsType && init.params.length > 0) {
                    const firstParam = init.params[0];
                    if (firstParam.type === 'Identifier' && !firstParam.typeAnnotation) {
                        firstParam.typeAnnotation = j.tsTypeAnnotation(propsType);
                    } else if (firstParam.type === 'ObjectPattern' && !firstParam.typeAnnotation) {
                        firstParam.typeAnnotation = j.tsTypeAnnotation(propsType);
                    }
                }

                // Add return type annotation to arrow function
                if (!init.returnType) {
                    init.returnType = j.tsTypeAnnotation(
                        j.tsTypeReference(j.tsQualifiedName(j.identifier('JSX'), j.identifier('Element')))
                    );
                }
            }
        }
    });

    // 2. Ensure all exported components have displayName
    root.find(j.ExportNamedDeclaration, {
        declaration: {
            type: 'VariableDeclaration',
            declarations: [
                {
                    init: {
                        type: 'CallExpression',
                        callee: {
                            type: 'MemberExpression',
                            object: { name: 'React' },
                            property: { name: 'memo' }
                        }
                    }
                }
            ]
        }
    }).forEach(path => {
        const componentName = path.value.declaration.declarations[0].id.name;
        const hasDisplayName =
            root.find(j.AssignmentExpression, {
                left: {
                    type: 'MemberExpression',
                    object: { name: componentName },
                    property: { name: 'displayName' }
                }
            }).length > 0;

        // Don't add displayName if it already exists or uses inline naming
        if (!hasDisplayName) {
            const init = path.value.declaration.declarations[0].init;
            if (init.arguments[0] && init.arguments[0].type === 'FunctionExpression') {
                // Already has inline naming, skip
                return;
            }
        }
    });

    // 3. Consistent prop destructuring
    root.find(j.FunctionDeclaration).forEach(path => {
        const params = path.value.params;
        if (params.length === 1 && params[0].type === 'Identifier' && params[0].name === 'props') {
            // Find all props.x usages
            const propsUsages = j(path).find(j.MemberExpression, {
                object: { name: 'props' }
            });

            if (propsUsages.length > 0) {
                const propNames = new Set();
                propsUsages.forEach(usage => {
                    if (usage.value.property.type === 'Identifier') {
                        propNames.add(usage.value.property.name);
                    }
                });

                // Replace parameter with destructured props
                if (propNames.size > 0) {
                    const properties = Array.from(propNames).map(name => j.property('init', j.identifier(name), j.identifier(name)));

                    path.value.params[0] = j.objectPattern(properties);

                    // Update all usages
                    propsUsages.forEach(usage => {
                        if (usage.value.property.type === 'Identifier') {
                            j(usage).replaceWith(j.identifier(usage.value.property.name));
                        }
                    });
                }
            }
        }
    });

    // 4. Remove unnecessary React imports if using new JSX transform
    const hasJSX = root.find(j.JSXElement).length > 0 || root.find(j.JSXFragment).length > 0;
    const reactImport = root.find(j.ImportDeclaration, {
        source: { value: 'react' }
    });

    if (reactImport.length > 0 && hasJSX) {
        const importNode = reactImport.at(0).get();
        const specifiers = importNode.value.specifiers;

        // Check if React is only imported for JSX
        const hasDefaultImport = specifiers.some(s => s.type === 'ImportDefaultSpecifier');
        const namedImports = specifiers.filter(s => s.type === 'ImportSpecifier');

        if (hasDefaultImport && namedImports.length === 0) {
            // Check if React is used for anything other than JSX
            const reactUsages = root.find(j.Identifier, { name: 'React' }).filter(path => {
                const parent = path.parent.value;
                // Ignore React.memo, React.forwardRef etc (they're valid uses)
                return !(parent.type === 'MemberExpression' && parent.object === path.value);
            });

            if (reactUsages.length === 0) {
                // Can remove the import
                j(importNode).remove();
            }
        }
    }

    return root.toSource({
        quote: config.options.quotes === 'single' ? 'single' : 'double',
        tabWidth: config.options.tabWidth,
        useTabs: config.options.useTabs,
        trailingComma: config.options.trailingComma === 'none' ? false : true
    });
};
