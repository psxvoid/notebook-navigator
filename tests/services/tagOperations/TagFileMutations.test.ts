/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { TagFileMutations } from '../../../src/services/tagOperations/TagFileMutations';
import type { NotebookNavigatorSettings } from '../../../src/settings/types';
import { DEFAULT_SETTINGS } from '../../../src/settings/defaultSettings';

vi.mock('obsidian', () => {
    class Notice {
        constructor(_message: unknown) {
            // no-op
        }
    }

    class TFile {
        path = '';
        extension = 'md';
    }

    return {
        App: class {},
        Modal: class {},
        Notice,
        Plugin: class {},
        TFile,
        TFolder: class {},
        getLanguage: () => 'en',
        normalizePath: (path: string) => path,
        parseFrontMatterTags: (frontmatter?: { tags?: string | string[] }) => {
            const raw = frontmatter?.tags;
            if (raw === undefined || raw === null) {
                return null;
            }
            if (Array.isArray(raw)) {
                const tags: string[] = [];
                for (const entry of raw) {
                    if (typeof entry !== 'string') {
                        continue;
                    }
                    entry
                        .split(/[, ]+/u)
                        .map(tag => tag.trim())
                        .filter(tag => tag.length > 0)
                        .forEach(tag => tags.push(tag));
                }
                return tags.length > 0 ? tags : null;
            }
            if (typeof raw === 'string') {
                const tags = raw
                    .split(/[, ]+/u)
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0);
                return tags.length > 0 ? tags : null;
            }
            return null;
        }
    };
});

const cachedTagsByPath = new Map<string, string[]>();

vi.mock('../../../src/storage/fileOperations', () => ({
    getDBInstance: () => ({
        getCachedTags: (path: string) => cachedTagsByPath.get(path) ?? []
    })
}));

function createFile(path: string, frontmatter: Record<string, unknown>, content: string) {
    const file = Object.assign(new TFile(), {
        path,
        frontmatter,
        content
    }) as TFile & { frontmatter: Record<string, unknown>; content: string };
    return file;
}

describe('TagFileMutations', () => {
    let app: App;
    let settings: NotebookNavigatorSettings;
    let fileMutations: TagFileMutations;

    beforeEach(() => {
        cachedTagsByPath.clear();
        settings = { ...DEFAULT_SETTINGS };

        const fileManager = {
            processFrontMatter: vi.fn((file: TFile, callback: (fm: Record<string, unknown>) => void) => {
                callback((file as unknown as { frontmatter: Record<string, unknown> }).frontmatter);
                return Promise.resolve();
            })
        };

        const vault = {
            read: vi.fn(async (file: TFile) => (file as unknown as { content: string }).content),
            modify: vi.fn(async (file: TFile, data: string) => {
                (file as unknown as { content: string }).content = data;
            }),
            process: vi.fn(async (file: TFile, processor: (content: string) => string) => {
                const next = processor((file as unknown as { content: string }).content);
                (file as unknown as { content: string }).content = next;
            })
        };

        app = {
            fileManager,
            vault
        } as unknown as App;

        fileMutations = new TagFileMutations(app, () => settings);
    });

    it('validates tag names using canonical rules', () => {
        expect(fileMutations.isValidTagName('project')).toBe(true);
        expect(fileMutations.isValidTagName('project/client')).toBe(true);
        expect(fileMutations.isValidTagName('project//client')).toBe(false);
        expect(fileMutations.isValidTagName('/leading')).toBe(false);
        expect(fileMutations.isValidTagName('trailing/')).toBe(false);
        expect(fileMutations.isValidTagName('')).toBe(false);
    });

    it('removes inline tag occurrences when removing tag from file', async () => {
        const file = createFile(
            'Projects/Client.md',
            { tags: ['project', 'project/client'] },
            '#project kickoff\nFollow up with #project/client tomorrow'
        );
        cachedTagsByPath.set(file.path, ['project', 'project/client']);

        const removed = await fileMutations.removeTagFromFile(file, 'project/client');

        expect(removed).toBe(true);
        expect(file.frontmatter.tags as string[]).toEqual(['project']);
        expect(file.content).toBe('#project kickoff\nFollow up with tomorrow');
    });

    it('collects descendant tags using cached data', () => {
        const file = createFile('Projects/Research.md', { tags: ['project', 'project/research'] }, '#project notes');
        cachedTagsByPath.set(file.path, ['project', 'project/research', 'project/research/notes']);

        const descendants = fileMutations.collectDescendantTags(file, 'project');

        expect(descendants).not.toBeNull();
        expect(descendants?.tags.sort()).toEqual(['project/research', 'project/research/notes']);
        expect(descendants?.normalizedSet.has('project/research')).toBe(true);
    });
});
