import { describe, it, expect } from 'vitest';
import { buildTagTreeFromDatabase, findTagNode } from '../../src/utils/tagTree';
import { normalizeTagPathValue } from '../../src/utils/tagPrefixMatcher';
import type { IndexedDBStorage, FileData } from '../../src/storage/IndexedDBStorage';
import type { TagTreeNode } from '../../src/types/storage';

interface MockFile {
    path: string;
    tags: string[] | null;
}

function createMockDb(files: MockFile[]): IndexedDBStorage {
    const payload = files.map(({ path, tags }) => ({
        path,
        data: createFileData(tags)
    }));

    return {
        getAllFiles: () => payload
    } as unknown as IndexedDBStorage;
}

function createFileData(tags: string[] | null): FileData {
    return {
        mtime: 0,
        tags,
        preview: null,
        featureImage: null,
        metadata: null
    };
}

function validateTreeHasNoSelfCycles(tree: Map<string, TagTreeNode>): void {
    const visited = new Set<TagTreeNode>();

    const visit = (node: TagTreeNode) => {
        expect(node.children.get(node.path)).toBeUndefined();
        for (const child of node.children.values()) {
            expect(child).not.toBe(node);
            if (!visited.has(child)) {
                visited.add(child);
                visit(child);
            }
        }
    };

    for (const root of tree.values()) {
        if (visited.has(root)) {
            continue;
        }
        visited.add(root);
        visit(root);
    }
}

describe('tag tree hardening', () => {
    it('normalizes repeated slashes from inline/frontmatter mixes without creating self-children', () => {
        const db = createMockDb([
            {
                path: 'inline.md',
                tags: ['#enemies//dragons', '#enemies/dragons//fire', '#enemies////dragons////fire']
            },
            {
                path: 'frontmatter.md',
                tags: ['enemies///dragons///ice', '#enemies/dragons//ice']
            }
        ]);

        const { tagTree } = buildTagTreeFromDatabase(db);
        validateTreeHasNoSelfCycles(tagTree);

        const enemiesPath = normalizeTagPathValue('#enemies');
        const dragonsPath = normalizeTagPathValue('#enemies//dragons');
        const firePath = normalizeTagPathValue('#enemies/dragons//fire');
        const icePath = normalizeTagPathValue('enemies///dragons///ice');

        expect(findTagNode(tagTree, enemiesPath)).not.toBeNull();
        expect(findTagNode(tagTree, dragonsPath)).not.toBeNull();
        expect(findTagNode(tagTree, firePath)).not.toBeNull();
        expect(findTagNode(tagTree, icePath)).not.toBeNull();
    });

    it('handles duplicate tag names like #tag/#tag without cycles', () => {
        const db = createMockDb([
            {
                path: 'dup.md',
                tags: ['#projects/projects', '#projects//projects//ideas', '#Projects/Projects///ideas///drafts']
            }
        ]);

        const { tagTree } = buildTagTreeFromDatabase(db);
        validateTreeHasNoSelfCycles(tagTree);

        const repeatedPath = normalizeTagPathValue('#projects//projects');
        const rootPath = normalizeTagPathValue('#projects');

        expect(findTagNode(tagTree, rootPath)).not.toBeNull();
        expect(findTagNode(tagTree, repeatedPath)).not.toBeNull();
    });

    it('ignores blank tag fragments and deduplicates casing collisions', () => {
        const db = createMockDb([
            {
                path: 'invalid.md',
                tags: ['', '#', '#/', '##', '#///', '#//', '////', '#Mixed//Case']
            },
            {
                path: 'valid.md',
                tags: ['#focus', 'focus//areas', '#Focus///Areas///deep']
            }
        ]);

        const { tagTree } = buildTagTreeFromDatabase(db);
        validateTreeHasNoSelfCycles(tagTree);
        expect(Array.from(tagTree.keys()).sort()).toEqual(['focus', 'mixed']);

        const focusPath = normalizeTagPathValue('#focus');
        const focusAreasPath = normalizeTagPathValue('focus//areas');
        const deepPath = normalizeTagPathValue('#Focus///Areas///deep');

        expect(findTagNode(tagTree, focusPath)).not.toBeNull();
        expect(findTagNode(tagTree, focusAreasPath)).not.toBeNull();
        expect(findTagNode(tagTree, deepPath)).not.toBeNull();
    });

    it('prevents runaway recursion in findTagNode even if a malformed cycle exists', () => {
        const root: TagTreeNode = {
            name: 'root',
            path: 'root',
            displayPath: 'root',
            children: new Map(),
            notesWithTag: new Set()
        };
        const child: TagTreeNode = {
            name: 'child',
            path: 'root/child',
            displayPath: 'root/child',
            children: new Map(),
            notesWithTag: new Set()
        };

        // Intentionally create a cycle to simulate corrupted caches
        root.children.set(child.path, child);
        child.children.set(root.path, root);

        const tree = new Map<string, TagTreeNode>([['root', root]]);
        expect(findTagNode(tree, 'root')).toBe(root);
        expect(findTagNode(tree, 'missing')).toBeNull();
    });
});
