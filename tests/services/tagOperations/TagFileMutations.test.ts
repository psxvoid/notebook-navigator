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

    it('skips removing inline tags inside code contexts', async () => {
        const file = createFile(
            'Projects/Review.md',
            { tags: ['project'] },
            [
                'Overview line #project with summary',
                'Johan',
                '```',
                '#project inside fenced block',
                '```',
                '`#project` inline code sample',
                'Final line #project after code'
            ].join('\n')
        );
        cachedTagsByPath.set(file.path, ['project']);

        const removed = await fileMutations.removeTagFromFile(file, 'project');

        expect(removed).toBe(true);
        const [textLine, nameLine, openingFence, fencedLine, closingFence, inlineCodeLine, finalLine] = file.content.split('\n');
        expect(textLine).not.toContain('#project');
        expect(nameLine).toBe('Johan');
        expect(openingFence).toBe('```');
        expect(fencedLine).toBe('#project inside fenced block');
        expect(closingFence).toBe('```');
        expect(inlineCodeLine).toBe('`#project` inline code sample');
        expect(finalLine).not.toContain('#project');
    });

    it('skips removing inline tags inside tilde code fences', async () => {
        const file = createFile(
            'Projects/Tilde.md',
            { tags: ['project'] },
            ['Intro line #project before code', '~~~', '#project inside tilde fenced block', '~~~', 'Outro line #project after code'].join(
                '\n'
            )
        );
        cachedTagsByPath.set(file.path, ['project']);

        const removed = await fileMutations.removeTagFromFile(file, 'project');

        expect(removed).toBe(true);
        const [introLine, openingFence, fencedLine, closingFence, outroLine] = file.content.split('\n');
        expect(introLine).not.toContain('#project');
        expect(openingFence).toBe('~~~');
        expect(fencedLine).toBe('#project inside tilde fenced block');
        expect(closingFence).toBe('~~~');
        expect(outroLine).not.toContain('#project');
    });

    it('removes inline tags inside indented markdown structures', async () => {
        const file = createFile(
            'Projects/Indented.md',
            { tags: ['project'] },
            [
                '- Parent task',
                '    - Child entry with #project tag',
                '    Text block with leading spaces and #project tag',
                '\t#project tab-indented tag'
            ].join('\n')
        );
        cachedTagsByPath.set(file.path, ['project']);

        const removed = await fileMutations.removeTagFromFile(file, 'project');

        expect(removed).toBe(true);
        const [parentLine, childLine, textLine, tabLine] = file.content.split('\n');
        expect(parentLine).toBe('- Parent task');
        expect(childLine).not.toContain('#project');
        expect(textLine).not.toContain('#project');
        expect(tabLine).not.toContain('#project');
    });

    it('keeps matches inside html tags when removing inline tags', async () => {
        const file = createFile(
            'Projects/Color.md',
            {},
            ['Inline tag #D10000 inside text', '<span style="color:#D10000">example</span>', '<a href="#D10000">link</a>'].join('\n')
        );
        cachedTagsByPath.set(file.path, ['D10000']);

        const removed = await fileMutations.removeTagFromFile(file, 'D10000');

        expect(removed).toBe(true);
        const [inlineText, spanLine, linkLine] = file.content.split('\n');
        expect(inlineText).not.toContain('#D10000');
        expect(spanLine).toContain('color:#D10000');
        expect(linkLine).toContain('href="#D10000"');
    });

    it('removes inline tags surrounded by comparison operators', async () => {
        const file = createFile('Projects/Compare.md', {}, 'Value < 5 #D10000 > threshold');
        cachedTagsByPath.set(file.path, ['D10000']);

        const removed = await fileMutations.removeTagFromFile(file, 'D10000');

        expect(removed).toBe(true);
        expect(file.content).toBe('Value < 5 > threshold');
    });

    it('collects descendant tags using cached data', () => {
        const file = createFile('Projects/Research.md', { tags: ['project', 'project/research'] }, '#project notes');
        cachedTagsByPath.set(file.path, ['project', 'project/research', 'project/research/notes']);

        const descendants = fileMutations.collectDescendantTags(file, 'project');

        expect(descendants).not.toBeNull();
        expect(descendants?.tags.sort()).toEqual(['project/research', 'project/research/notes']);
        expect(descendants?.normalizedSet.has('project/research')).toBe(true);
    });

    it('preserves code and html contexts when clearing all tags', async () => {
        const file = createFile(
            'Notes/Inline.md',
            { tags: ['ai', 'research'] },
            [
                'First line #ai tag',
                '```',
                '#ai inside fenced block',
                '```',
                '<span style="color: #0009D1">prova</span>',
                '`#ai` inline code sample',
                'Final #research line'
            ].join('\n')
        );
        cachedTagsByPath.set(file.path, ['ai', 'research']);

        const cleared = await fileMutations.clearAllTagsFromFile(file);

        expect(cleared).toBe(true);
        expect(Reflect.has(file.frontmatter, 'tags')).toBe(false);
        const [textLine, openingFence, fencedLine, closingFence, spanLine, inlineCodeLine, finalLine] = file.content.split('\n');
        expect(textLine).toBe('First line tag');
        expect(openingFence).toBe('```');
        expect(fencedLine).toBe('#ai inside fenced block');
        expect(closingFence).toBe('```');
        expect(spanLine).toContain('#0009D1');
        expect(inlineCodeLine).toBe('`#ai` inline code sample');
        expect(finalLine).toBe('Final line');
    });
});
