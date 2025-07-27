import { ASTPath, Collection, JSCodeshift } from 'jscodeshift';

interface DependencyNode {
    name: string;
    path: ASTPath;
    dependencies: Set<string>;
    declaredAt: number;
}

export class DependencyAnalyzer {
    private j: JSCodeshift;
    private dependencies: Map<string, DependencyNode> = new Map();
    private usages: Map<string, Set<number>> = new Map();

    constructor(j: JSCodeshift) {
        this.j = j;
    }

    analyze(root: Collection): void {
        this.collectDeclarations(root);
        this.collectUsages(root);
        this.buildDependencyGraph(root);
    }

    private collectDeclarations(root: Collection): void {
        // Function declarations
        root.find(this.j.FunctionDeclaration).forEach(path => {
            const name = path.node.id?.name;
            if (name && typeof name === 'string') {
                this.dependencies.set(name, {
                    name,
                    path,
                    dependencies: new Set(),
                    declaredAt: path.node.loc?.start.line || 0
                });
            }
        });

        // Variable declarations
        root.find(this.j.VariableDeclarator).forEach(path => {
            if (path.node.id.type === 'Identifier') {
                const name = path.node.id.name;
                this.dependencies.set(name, {
                    name,
                    path,
                    dependencies: new Set(),
                    declaredAt: path.node.loc?.start.line || 0
                });
            }
        });

        // Exported function declarations
        root.find(this.j.ExportNamedDeclaration).forEach(path => {
            if (this.j.FunctionDeclaration.check(path.node.declaration)) {
                const name = path.node.declaration.id?.name;
                if (name && typeof name === 'string') {
                    this.dependencies.set(name, {
                        name,
                        path,
                        dependencies: new Set(),
                        declaredAt: path.node.loc?.start.line || 0
                    });
                }
            }
        });
    }

    private collectUsages(root: Collection): void {
        root.find(this.j.Identifier).forEach(path => {
            const name = path.node.name;
            const line = path.node.loc?.start.line || 0;

            // Skip if this is a declaration
            const parent = path.parent;
            if (
                (this.j.VariableDeclarator.check(parent.node) && parent.node.id === path.node) ||
                (this.j.FunctionDeclaration.check(parent.node) && parent.node.id === path.node) ||
                (this.j.Property.check(parent.node) && parent.node.key === path.node && !parent.node.computed)
            ) {
                return;
            }

            if (!this.usages.has(name)) {
                this.usages.set(name, new Set());
            }
            this.usages.get(name)!.add(line);
        });
    }

    private buildDependencyGraph(root: Collection): void {
        this.dependencies.forEach((node, name) => {
            // Find the scope of this declaration
            const declarationPath = node.path;
            const declarationBody = this.getDeclarationBody(declarationPath);

            if (declarationBody) {
                // Find all identifiers used within this declaration
                this.j(declarationBody)
                    .find(this.j.Identifier)
                    .forEach(identPath => {
                        const identName = identPath.node.name;

                        // Skip self-references and property keys
                        if (identName === name) return;

                        const parent = identPath.parent;
                        if (this.j.Property.check(parent.node) && parent.node.key === identPath.node && !parent.node.computed) {
                            return;
                        }

                        // Check if this identifier refers to a declaration we track
                        if (this.dependencies.has(identName)) {
                            node.dependencies.add(identName);
                        }
                    });
            }
        });
    }

    private getDeclarationBody(path: ASTPath): any {
        const node = path.node;

        if (this.j.FunctionDeclaration.check(node)) {
            return node.body;
        }

        if (this.j.VariableDeclarator.check(node)) {
            return node.init;
        }

        if (this.j.ExportNamedDeclaration.check(node) && this.j.FunctionDeclaration.check(node.declaration)) {
            return node.declaration.body;
        }

        return null;
    }

    topologicalSort(nodes: any[]): any[] {
        const sorted: any[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const nodeMap = new Map<string, any>();
        nodes.forEach(node => {
            const name = this.getNodeName(node);
            if (name) {
                nodeMap.set(name, node);
            }
        });

        const visit = (name: string): void => {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
                console.warn(`Circular dependency detected involving: ${name}`);
                return;
            }

            visiting.add(name);
            const depNode = this.dependencies.get(name);

            if (depNode) {
                depNode.dependencies.forEach(dep => {
                    if (nodeMap.has(dep)) {
                        visit(dep);
                    }
                });
            }

            visiting.delete(name);
            visited.add(name);

            const node = nodeMap.get(name);
            if (node) {
                sorted.push(node);
            }
        };

        nodes.forEach(node => {
            const name = this.getNodeName(node);
            if (name && !visited.has(name)) {
                visit(name);
            }
        });

        // Add any nodes we couldn't process (no name, etc)
        nodes.forEach(node => {
            const name = this.getNodeName(node);
            if (!name || !visited.has(name)) {
                sorted.push(node);
            }
        });

        return sorted;
    }

    private getNodeName(node: any): string | null {
        if (node.id?.name) return node.id.name;
        if (node.declaration?.id?.name) return node.declaration.id.name;
        if (node.declaration?.declarations?.[0]?.id?.name) {
            return node.declaration.declarations[0].id.name;
        }
        if (node.declarations?.[0]?.id?.name) {
            return node.declarations[0].id.name;
        }
        return null;
    }

    getDependencies(name: string): Set<string> {
        return this.dependencies.get(name)?.dependencies || new Set();
    }

    getUsageLines(name: string): Set<number> {
        return this.usages.get(name) || new Set();
    }
}
