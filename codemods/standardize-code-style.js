/**
 * Codemod to standardize code style patterns
 */

const config = require('../.jscodeshift.config');

module.exports = function transformer(fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    // 1. Convert == to === and != to !==
    root.find(j.BinaryExpression, { operator: '==' }).replaceWith(path => {
        return j.binaryExpression('===', path.value.left, path.value.right);
    });

    root.find(j.BinaryExpression, { operator: '!=' }).replaceWith(path => {
        return j.binaryExpression('!==', path.value.left, path.value.right);
    });

    // 2. Remove unnecessary else after return
    root.find(j.IfStatement).forEach(path => {
        const { consequent, alternate } = path.value;

        if (alternate && consequent.type === 'BlockStatement') {
            const lastStatement = consequent.body[consequent.body.length - 1];

            if (lastStatement && lastStatement.type === 'ReturnStatement') {
                // Move alternate to after the if statement
                const parent = path.parent;
                if (parent.value.type === 'BlockStatement') {
                    const index = parent.value.body.indexOf(path.value);

                    if (alternate.type === 'BlockStatement') {
                        // Insert all statements from else block
                        parent.value.body.splice(index + 1, 0, ...alternate.body);
                    } else {
                        // Insert single statement
                        parent.value.body.splice(index + 1, 0, alternate);
                    }

                    // Remove else
                    path.value.alternate = null;
                }
            }
        }
    });

    // 3. Use optional chaining where possible
    root.find(j.LogicalExpression, { operator: '&&' }).forEach(path => {
        const { left, right } = path.value;

        // Pattern: obj && obj.prop
        if (
            left.type === 'Identifier' &&
            right.type === 'MemberExpression' &&
            right.object.type === 'Identifier' &&
            right.object.name === left.name
        ) {
            j(path).replaceWith(j.optionalMemberExpression(left, right.property, false, true));
        }

        // Pattern: obj.prop1 && obj.prop1.prop2
        if (
            left.type === 'MemberExpression' &&
            right.type === 'MemberExpression' &&
            right.object.type === 'MemberExpression' &&
            j(left).toSource() === j(right.object).toSource()
        ) {
            j(path).replaceWith(j.optionalMemberExpression(right.object, right.property, false, true));
        }
    });

    // 4. Convert string concatenation to template literals
    root.find(j.BinaryExpression, { operator: '+' }).forEach(path => {
        if (isStringConcatenation(path.value)) {
            const parts = collectConcatenationParts(path.value);
            const quasis = [];
            const expressions = [];

            parts.forEach((part, index) => {
                if (part.type === 'Literal' && typeof part.value === 'string') {
                    quasis.push(j.templateElement({ cooked: part.value, raw: part.value }, index === parts.length - 1));
                } else {
                    if (quasis.length === expressions.length) {
                        quasis.push(j.templateElement({ cooked: '', raw: '' }, false));
                    }
                    expressions.push(part);
                }
            });

            if (quasis.length === expressions.length) {
                quasis.push(j.templateElement({ cooked: '', raw: '' }, true));
            }

            j(path).replaceWith(j.templateLiteral(quasis, expressions));
        }
    });

    // 5. Use const for never-reassigned variables
    root.find(j.VariableDeclaration, { kind: 'let' }).forEach(path => {
        const declarations = path.value.declarations;

        const canBeConst = declarations.every(decl => {
            if (!decl.id || decl.id.type !== 'Identifier') return false;

            const name = decl.id.name;
            const scope = path.scope;

            // Check if variable is ever reassigned
            const reassignments = j(scope.path).find(j.AssignmentExpression, {
                left: { type: 'Identifier', name }
            });

            const updates = j(scope.path).find(j.UpdateExpression, {
                argument: { type: 'Identifier', name }
            });

            return reassignments.length === 0 && updates.length === 0;
        });

        if (canBeConst) {
            path.value.kind = 'const';
        }
    });

    // 6. Remove console.log statements (optional - check config)
    if (config.options.removeConsoleLog) {
        root.find(j.CallExpression, {
            callee: {
                type: 'MemberExpression',
                object: { name: 'console' },
                property: { name: 'log' }
            }
        }).remove();
    }

    return root.toSource({
        quote: config.options.quotes === 'single' ? 'single' : 'double',
        tabWidth: config.options.tabWidth,
        useTabs: config.options.useTabs,
        trailingComma: config.options.trailingComma === 'none' ? false : true
    });
};

function isStringConcatenation(node) {
    if (node.type !== 'BinaryExpression' || node.operator !== '+') return false;

    const hasString = n => {
        if (n.type === 'Literal' && typeof n.value === 'string') return true;
        if (n.type === 'BinaryExpression' && n.operator === '+') {
            return hasString(n.left) || hasString(n.right);
        }
        return false;
    };

    return hasString(node);
}

function collectConcatenationParts(node) {
    if (node.type !== 'BinaryExpression' || node.operator !== '+') {
        return [node];
    }

    return [...collectConcatenationParts(node.left), ...collectConcatenationParts(node.right)];
}
