/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad, modifications by Pavel Sapehin
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, it, expect } from 'vitest';
import { buildTagTreeFromDatabase, findTagNode, collectTagFilePaths, collectAllTagPaths, getTotalNoteCount } from '../../src/utils/tagTree';
import { normalizeTagPathValue } from '../../src/utils/tagPrefixMatcher';
import type { IndexedDBStorage, FileData, TagsV2 } from '../../src/storage/IndexedDBStorage';
import type { TagTreeNode } from '../../src/types/storage';
import { CacheCustomFields } from '../../src/types';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';

interface MockFile {
    path: string;
    tags: TagsV2;
}

function createMockDb(files: MockFile[]): IndexedDBStorage {
    const payload = files.map(({ path, tags }) => ({
        path,
        data: createFileData(tags)
    }));

    return {
        getAllFiles: () => payload,
        forEachFile: (callback: (path: string, data: FileData) => void) => {
            payload.forEach(({ path, data }) => callback(path, data));
        }
    } as unknown as IndexedDBStorage;
}

function createFileData(tags: TagsV2): FileData {
    return {
        mtime: 0,
        tags,
        preview: null,
        featureImage: null,
        featureImageResized: null,
        featureImageProvider: null,
        featureImageConsumers: null,
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
                tags: new Map([[CacheCustomFields.TagDefault, ['#enemies//dragons', '#enemies/dragons//fire', '#enemies////dragons////fire']]])
            },
            {
                path: 'frontmatter.md',
                tags: new Map([[CacheCustomFields.TagDefault, ['enemies///dragons///ice', '#enemies/dragons//ice']]])
            }
        ]);

        const { tagTree } = buildTagTreeFromDatabase(db, DEFAULT_SETTINGS);
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
                tags: new Map([[CacheCustomFields.TagDefault, ['#projects/projects', '#projects//projects//ideas', '#Projects/Projects///ideas///drafts']]])
            }
        ]);

        const { tagTree } = buildTagTreeFromDatabase(db, DEFAULT_SETTINGS);
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
                tags: new Map([[CacheCustomFields.TagDefault, ['', '#', '#/', '##', '#///', '#//', '////', '#Mixed//Case']]])
            },
            {
                path: 'valid.md',
                tags: new Map([[CacheCustomFields.TagDefault, ['#focus', 'focus//areas', '#Focus///Areas///deep']]])
            }
        ]);

        const { tagTree } = buildTagTreeFromDatabase(db, DEFAULT_SETTINGS);
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

    it('guards traversal helpers against malformed cycles introduced by invalid tags', () => {
        const root: TagTreeNode = {
            name: 'root',
            path: 'root',
            displayPath: 'root',
            children: new Map(),
            notesWithTag: new Set(['root.md'])
        };
        const child: TagTreeNode = {
            name: 'child',
            path: 'root//child',
            displayPath: 'root//child',
            children: new Map(),
            notesWithTag: new Set(['child.md'])
        };

        // Simulate a corrupted structure where the child references the parent.
        root.children.set(child.path, child);
        child.children.set(root.path, root);

        const files = collectTagFilePaths(root);
        expect(files).toEqual(new Set(['root.md', 'child.md']));

        const paths = Array.from(collectAllTagPaths(root)).sort();
        expect(paths).toEqual(['root', 'root//child']);

        expect(getTotalNoteCount(root)).toBe(2);
    });
});

describe('tagged count visibility', () => {
    it('excludes files with only hidden tags when hidden tags are filtered', () => {
        const db = createMockDb([
            { path: 'visible.md', tags: new Map([[CacheCustomFields.TagDefault, ['projects/work']]]) },
            { path: 'hidden.md', tags: new Map([[CacheCustomFields.TagDefault, ['archive/secret']]]) }
        ]);

        const filtered = buildTagTreeFromDatabase(db, DEFAULT_SETTINGS, undefined, undefined, ['archive'], false);
        expect(filtered.tagged).toBe(1);

        const unfiltered = buildTagTreeFromDatabase(db, DEFAULT_SETTINGS, undefined, undefined, ['archive'], true);
        expect(unfiltered.tagged).toBe(2);
    });
});
