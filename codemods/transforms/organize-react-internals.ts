import { Transform } from 'jscodeshift';

const transform: Transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    // Find all function components (including those wrapped in memo/forwardRef)
    const findComponentFunctions = () => {
        const components: any[] = [];

        // Find regular function declarations
        root.find(j.FunctionDeclaration).forEach(path => {
            const name = typeof path.node.id?.name === 'string' ? path.node.id.name : '';
            if (/^[A-Z]/.test(name)) {
                components.push(path);
            }
        });

        // Find arrow function components
        root.find(j.VariableDeclarator).forEach(path => {
            const name = path.node.id?.type === 'Identifier' ? path.node.id.name : '';
            if (/^[A-Z]/.test(name) && (j.ArrowFunctionExpression.check(path.node.init) || j.FunctionExpression.check(path.node.init))) {
                components.push(path);
            }
        });

        // Find components inside React.memo, forwardRef, etc.
        root.find(j.CallExpression).forEach(path => {
            const callee = path.node.callee;
            if (
                (j.MemberExpression.check(callee) &&
                    callee.object.type === 'Identifier' &&
                    callee.object.name === 'React' &&
                    callee.property.type === 'Identifier' &&
                    ['memo', 'forwardRef'].includes(callee.property.name)) ||
                (j.Identifier.check(callee) && ['memo', 'forwardRef'].includes(callee.name))
            ) {
                // Find the actual component function inside
                const arg = path.node.arguments[0];
                if (j.FunctionExpression.check(arg) || j.ArrowFunctionExpression.check(arg)) {
                    components.push(path);
                } else if (j.CallExpression.check(arg)) {
                    // Handle nested calls like React.memo(forwardRef(...))
                    const innerArg = arg.arguments[0];
                    if (j.FunctionExpression.check(innerArg) || j.ArrowFunctionExpression.check(innerArg)) {
                        components.push(path);
                    }
                }
            }
        });

        return components;
    };

    const organizeComponentBody = (bodyStatements: any[]) => {
        const organized = {
            // Destructuring and variable declarations from hooks/props
            destructuring: [] as any[],
            // useState, useRef, etc.
            stateAndRefs: [] as any[],
            // useMemo, useCallback
            memoized: [] as any[],
            // useEffect, useLayoutEffect
            effects: [] as any[],
            // Regular const/let/var declarations
            variables: [] as any[],
            // Function declarations
            functions: [] as any[],
            // Event handlers (handleXxx, onXxx)
            handlers: [] as any[],
            // Conditional early returns
            earlyReturns: [] as any[],
            // Everything else before return
            other: [] as any[],
            // The return statement
            returnStatement: null as any
        };

        bodyStatements.forEach(statement => {
            // Skip if it's the return statement
            if (j.ReturnStatement.check(statement)) {
                organized.returnStatement = statement;
                return;
            }

            // Early returns (if statements with returns)
            if (j.IfStatement.check(statement) && statement.consequent && j.ReturnStatement.check(statement.consequent)) {
                organized.earlyReturns.push(statement);
                return;
            }

            // Variable declarations
            if (j.VariableDeclaration.check(statement)) {
                const firstDeclarator = statement.declarations[0];
                if (!firstDeclarator || !j.VariableDeclarator.check(firstDeclarator)) {
                    organized.other.push(statement);
                    return;
                }

                const init = firstDeclarator.init;
                const id = firstDeclarator.id;

                // Check if it's a hook call
                if (j.CallExpression.check(init)) {
                    const calleeName = getCalleeName(init);

                    // State and ref hooks
                    if (['useState', 'useRef', 'useReducer', 'useContext'].includes(calleeName)) {
                        organized.stateAndRefs.push(statement);
                        return;
                    }

                    // Memoization hooks
                    if (['useMemo', 'useCallback'].includes(calleeName)) {
                        organized.memoized.push(statement);
                        return;
                    }

                    // Custom hooks or other hook calls
                    if (calleeName.startsWith('use')) {
                        organized.stateAndRefs.push(statement);
                        return;
                    }

                    // Destructuring from props or context
                    if (id.type === 'ObjectPattern' || id.type === 'ArrayPattern') {
                        organized.destructuring.push(statement);
                        return;
                    }
                }

                // Event handlers
                if (id.type === 'Identifier') {
                    const name = id.name;
                    if (name.startsWith('handle') || name.startsWith('on')) {
                        organized.handlers.push(statement);
                        return;
                    }
                }

                // Regular variables
                organized.variables.push(statement);
                return;
            }

            // Function declarations
            if (j.FunctionDeclaration.check(statement)) {
                const name = typeof statement.id?.name === 'string' ? statement.id.name : '';
                if (name.startsWith('handle') || name.startsWith('on')) {
                    organized.handlers.push(statement);
                } else {
                    organized.functions.push(statement);
                }
                return;
            }

            // Expression statements (useEffect calls, etc.)
            if (j.ExpressionStatement.check(statement) && j.CallExpression.check(statement.expression)) {
                const calleeName = getCalleeName(statement.expression);
                if (['useEffect', 'useLayoutEffect', 'useInsertionEffect'].includes(calleeName)) {
                    organized.effects.push(statement);
                    return;
                }
            }

            // Everything else
            organized.other.push(statement);
        });

        // Build reorganized body
        const newBody: any[] = [];

        // Add sections in order with spacing
        const addSection = (items: any[]) => {
            if (items.length > 0) {
                if (newBody.length > 0) {
                    // Add empty line between sections
                    newBody.push(j.noop());
                }
                newBody.push(...items);
            }
        };

        addSection(organized.destructuring);
        addSection(organized.stateAndRefs);
        addSection(organized.memoized);
        addSection(organized.variables);
        addSection(organized.handlers);
        addSection(organized.functions);
        addSection(organized.effects);
        addSection(organized.earlyReturns);
        addSection(organized.other);

        if (organized.returnStatement) {
            if (newBody.length > 0) {
                newBody.push(j.noop());
            }
            newBody.push(organized.returnStatement);
        }

        return newBody;
    };

    const getCalleeName = (callExpr: any): string => {
        if (j.Identifier.check(callExpr.callee)) {
            return callExpr.callee.name;
        }
        if (j.MemberExpression.check(callExpr.callee) && j.Identifier.check(callExpr.callee.property)) {
            return callExpr.callee.property.name;
        }
        return '';
    };

    // Process each component
    const components = findComponentFunctions();

    components.forEach(componentPath => {
        let functionBody: any = null;

        // Extract the function body based on the component type
        if (j.FunctionDeclaration.check(componentPath.node)) {
            functionBody = componentPath.node.body;
        } else if (j.VariableDeclarator.check(componentPath.node)) {
            const init = componentPath.node.init;
            if (j.ArrowFunctionExpression.check(init) || j.FunctionExpression.check(init)) {
                functionBody = init.body;
            }
        } else if (j.CallExpression.check(componentPath.node)) {
            // Handle React.memo, forwardRef, etc.
            let func = componentPath.node.arguments[0];

            // Handle nested calls
            while (j.CallExpression.check(func)) {
                func = func.arguments[0];
            }

            if ((j.FunctionExpression.check(func) || j.ArrowFunctionExpression.check(func)) && j.BlockStatement.check(func.body)) {
                functionBody = func.body;
            }
        }

        // Organize the function body if found
        if (functionBody && j.BlockStatement.check(functionBody)) {
            const organized = organizeComponentBody(functionBody.body);
            functionBody.body = organized;
        }
    });

    return root.toSource({ quote: 'single', trailingComma: true });
};

export default transform;
