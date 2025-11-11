import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import * as TagRenameModule from '../../src/services/tagRename/TagRenameEngine';
import { TagOperations } from '../../src/services/TagOperations';
import { ShortcutType, type ShortcutEntry } from '../../src/types/shortcuts';
import { TAGGED_TAG_ID } from '../../src/types';
import type { NotebookNavigatorSettings } from '../../src/settings';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { ISettingsProvider } from '../../src/interfaces/ISettingsProvider';
import type { TagTreeService } from '../../src/services/TagTreeService';
import type { MetadataService } from '../../src/services/MetadataService';
import { createVaultProfile, getActiveVaultProfile } from '../../src/utils/vaultProfiles';
import type { VaultProfile } from '../../src/settings/types';

vi.mock('obsidian', () => {
    class Modal {}
    class TFile {}
    class Notice {
        constructor(public message: unknown) {
            // no-op
        }
    }

    return {
        App: class {},
        Modal,
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

vi.mock('../../src/storage/fileOperations', () => ({
    getDBInstance: () => ({
        getCachedTags: (path: string) => cachedTagsByPath.get(path) ?? []
    })
}));

function createSettings(): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        vaultProfiles: DEFAULT_SETTINGS.vaultProfiles.map(profile =>
            createVaultProfile(profile.name, {
                id: profile.id,
                hiddenFolders: profile.hiddenFolders,
                hiddenFiles: profile.hiddenFiles,
                hiddenTags: profile.hiddenTags,
                fileVisibility: profile.fileVisibility,
                navigationBanner: profile.navigationBanner,
                shortcuts: profile.shortcuts
            })
        )
    };
}

function createVaultProfileStub(id: string, shortcuts: ShortcutEntry[]): VaultProfile {
    return createVaultProfile(id, {
        id,
        hiddenFolders: [],
        hiddenFiles: [],
        hiddenTags: [],
        shortcuts
    });
}

function createSettingsProvider(settings: NotebookNavigatorSettings): ISettingsProvider & {
    saveSettingsAndUpdate: ReturnType<typeof vi.fn>;
} {
    const saveSettingsAndUpdate = vi.fn().mockResolvedValue(undefined);
    return {
        settings,
        saveSettingsAndUpdate,
        notifySettingsUpdate: vi.fn(),
        getRecentNotes: () => [],
        setRecentNotes: vi.fn(),
        getRecentIcons: () => ({}),
        setRecentIcons: vi.fn()
    };
}

function createTagOperations(settings: NotebookNavigatorSettings) {
    const provider = createSettingsProvider(settings);
    const metadataServiceStub = {
        getSettingsProvider: () => provider
    } as unknown;
    const appStub = { vault: {} } as unknown as App;
    const tagOperations = new TagOperations(
        appStub,
        () => settings,
        () => null,
        () => metadataServiceStub as any
    );
    return { tagOperations, provider };
}

beforeEach(() => {
    cachedTagsByPath.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('TagDescriptor', () => {
    it('normalizes canonical form while preserving display casing', () => {
        const descriptor = new TagRenameModule.TagDescriptor('Projects/Archive/');
        expect(descriptor.tag).toBe('#Projects/Archive/');
        expect(descriptor.canonical).toBe('#projects/archive');
        expect(descriptor.canonicalName).toBe('projects/archive');
    });

    it('matches descendants regardless of hash or casing', () => {
        const descriptor = new TagRenameModule.TagDescriptor('#Projects');
        expect(descriptor.matches('projects')).toBe(true);
        expect(descriptor.matches('Projects/Archive')).toBe(true);
        expect(descriptor.matches('#projects/archive')).toBe(true);
    });
});

describe('isDescendantRename', () => {
    it('returns true when the new tag is within the original hierarchy', () => {
        const original = new TagRenameModule.TagDescriptor('Projects');
        const descendant = new TagRenameModule.TagDescriptor('Projects/Archive');
        expect(TagRenameModule.isDescendantRename(original, descendant)).toBe(true);
    });

    it('returns false for unrelated or sibling tags', () => {
        const original = new TagRenameModule.TagDescriptor('Projects');
        const sibling = new TagRenameModule.TagDescriptor('ProjectsArchive');
        expect(TagRenameModule.isDescendantRename(original, sibling)).toBe(false);
    });
});

describe('TagReplacement', () => {
    it('renames lowercase frontmatter tags without hashes', () => {
        const replacement = new TagRenameModule.TagReplacement(
            new TagRenameModule.TagDescriptor('Projects'),
            new TagRenameModule.TagDescriptor('Areas')
        );
        const [updated] = replacement.inArray(['projects'], false, false) as string[];
        expect(updated).toBe('Areas');
    });

    it('renames lowercase tags with descendants', () => {
        const replacement = new TagRenameModule.TagReplacement(
            new TagRenameModule.TagDescriptor('Projects'),
            new TagRenameModule.TagDescriptor('Areas')
        );
        const [updated] = replacement.inArray(['projects/archive'], false, false) as string[];
        expect(updated).toBe('Areas/archive');
    });

    it('detects collisions when renamed tag already exists', () => {
        const replacement = new TagRenameModule.TagReplacement(
            new TagRenameModule.TagDescriptor('Projects'),
            new TagRenameModule.TagDescriptor('Areas')
        );
        const collision = replacement.willMergeTags(['#Projects', '#areas']);
        expect(collision).not.toBeNull();
        if (!collision) {
            return;
        }
        const [origin, target] = collision;
        expect(origin.canonical).toBe('#projects');
        expect(target.canonical).toBe('#areas');
    });
});

describe('TagOperations shortcut migration', () => {
    it('renames tag shortcuts that match the renamed tag', async () => {
        const settings = createSettings();
        const profile = getActiveVaultProfile(settings);
        profile.shortcuts = [
            { type: ShortcutType.TAG, tagPath: 'projects' },
            { type: ShortcutType.NOTE, path: 'Notes.md' },
            { type: ShortcutType.TAG, tagPath: 'projects/client' }
        ];
        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).updateTagShortcutsAfterRename('projects', 'areas');

        expect(profile.shortcuts).toEqual([
            { type: ShortcutType.TAG, tagPath: 'areas' },
            { type: ShortcutType.NOTE, path: 'Notes.md' },
            { type: ShortcutType.TAG, tagPath: 'areas/client' }
        ]);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('drops shortcuts when rename collides with existing destination', async () => {
        const settings = createSettings();
        const profile = getActiveVaultProfile(settings);
        profile.shortcuts = [
            { type: ShortcutType.TAG, tagPath: 'areas' },
            { type: ShortcutType.TAG, tagPath: 'projects' }
        ];
        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).updateTagShortcutsAfterRename('projects', 'areas');

        expect(profile.shortcuts).toEqual([{ type: ShortcutType.TAG, tagPath: 'areas' }]);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('leaves shortcuts untouched when new path matches old path after normalization', async () => {
        const settings = createSettings();
        const profile = getActiveVaultProfile(settings);
        profile.shortcuts = [{ type: ShortcutType.TAG, tagPath: 'projects' }];
        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).updateTagShortcutsAfterRename('Projects', 'projects');

        expect(profile.shortcuts).toEqual([{ type: ShortcutType.TAG, tagPath: 'projects' }]);
        expect(provider.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });
});

describe('TagOperations shortcut cleanup on delete', () => {
    it('removes tag shortcuts for deleted tag hierarchy', async () => {
        const settings = createSettings();
        const profile = getActiveVaultProfile(settings);
        profile.shortcuts = [
            { type: ShortcutType.TAG, tagPath: 'projects' },
            { type: ShortcutType.TAG, tagPath: 'projects/client' },
            { type: ShortcutType.NOTE, path: 'Notes.md' }
        ];
        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).removeTagShortcutsAfterDelete('projects');

        expect(profile.shortcuts).toEqual([{ type: ShortcutType.NOTE, path: 'Notes.md' }]);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('skips saving when no shortcuts reference deleted tag', async () => {
        const settings = createSettings();
        const profile = getActiveVaultProfile(settings);
        profile.shortcuts = [{ type: ShortcutType.NOTE, path: 'Notes.md' }];
        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).removeTagShortcutsAfterDelete('projects');

        expect(profile.shortcuts).toEqual([{ type: ShortcutType.NOTE, path: 'Notes.md' }]);
        expect(provider.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });
});

describe('TagOperations multi-profile shortcuts', () => {
    it('renames tag shortcuts across every vault profile', async () => {
        const settings = createSettings();
        const primary = getActiveVaultProfile(settings);
        primary.shortcuts = [
            { type: ShortcutType.TAG, tagPath: 'projects' },
            { type: ShortcutType.TAG, tagPath: 'projects/delta' }
        ];
        const secondary = createVaultProfileStub('secondary', [
            { type: ShortcutType.TAG, tagPath: 'projects' },
            { type: ShortcutType.NOTE, path: 'Other.md' },
            { type: ShortcutType.TAG, tagPath: 'projects/beta' }
        ]);
        settings.vaultProfiles.push(secondary);

        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).updateTagShortcutsAfterRename('projects', 'areas');

        expect(primary.shortcuts).toEqual([
            { type: ShortcutType.TAG, tagPath: 'areas' },
            { type: ShortcutType.TAG, tagPath: 'areas/delta' }
        ]);
        expect(secondary.shortcuts).toEqual([
            { type: ShortcutType.TAG, tagPath: 'areas' },
            { type: ShortcutType.NOTE, path: 'Other.md' },
            { type: ShortcutType.TAG, tagPath: 'areas/beta' }
        ]);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('removes deleted tag shortcuts from every vault profile', async () => {
        const settings = createSettings();
        const primary = getActiveVaultProfile(settings);
        primary.shortcuts = [
            { type: ShortcutType.TAG, tagPath: 'projects' },
            { type: ShortcutType.NOTE, path: 'Notes.md' }
        ];
        const secondary = createVaultProfileStub('secondary', [
            { type: ShortcutType.TAG, tagPath: 'projects/child' },
            { type: ShortcutType.NOTE, path: 'Archive.md' }
        ]);
        settings.vaultProfiles.push(secondary);

        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).removeTagShortcutsAfterDelete('projects');

        expect(primary.shortcuts).toEqual([{ type: ShortcutType.NOTE, path: 'Notes.md' }]);
        expect(secondary.shortcuts).toEqual([{ type: ShortcutType.NOTE, path: 'Archive.md' }]);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });
});

describe('TagOperations tag deletion', () => {
    it('removes direct and descendant tags from a file once confirmed', async () => {
        const settings = createSettings();
        const frontmatter = {
            tags: ['project', 'project/client'] as string[] | string,
            aliases: ['#project', '#project/client', 'Project kickoff'],
            alias: '#project/client'
        };
        const file = Object.assign(new TFile(), {
            path: 'Project.md',
            extension: 'md',
            frontmatter,
            content: '#project kickoff\nTasks include #project/client follow-up.'
        }) as TFile & { frontmatter: { tags?: string | string[]; aliases?: string | string[]; alias?: string }; content: string };

        cachedTagsByPath.set(file.path, ['project', 'project/client']);

        const fileManager = {
            processFrontMatter: vi.fn((_file: TFile, callback: (fm: Record<string, unknown>) => void) => {
                callback(file.frontmatter as unknown as Record<string, unknown>);
                return Promise.resolve();
            })
        };

        const vault = {
            getAbstractFileByPath: vi.fn((path: string) => (path === file.path ? file : null)),
            process: vi.fn(async (_file: TFile, processor: (content: string) => string) => {
                const updated = processor(file.content);
                file.content = updated;
            })
        };

        const provider = createSettingsProvider(settings);
        const metadataService = {
            getSettingsProvider: () => provider,
            handleTagDelete: vi.fn().mockResolvedValue(undefined)
        };

        const tagOperations = new TagOperations(
            { vault, fileManager } as unknown as App,
            () => settings,
            () => null,
            () => metadataService as any
        );

        const result = await (tagOperations as any).runTagDelete('project', [file.path]);

        expect(result).toBe(true);
        expect(fileManager.processFrontMatter).toHaveBeenCalled();
        expect(vault.process).toHaveBeenCalled();
        expect(file.frontmatter.tags).toBeUndefined();
        expect(file.frontmatter.aliases).toEqual(['Project kickoff']);
        expect(file.frontmatter.alias).toBeUndefined();
        expect(file.content).not.toContain('#project');
        expect(file.content).not.toContain('#project/client');
        expect(file.content).not.toContain('/client');
        expect(metadataService.handleTagDelete).toHaveBeenCalledWith('project');
    });

    it('removes tags when frontmatter uses scalar string formatting', async () => {
        const settings = createSettings();
        const frontmatter = {
            tags: 'project project/client other'
        };

        const file = Object.assign(new TFile(), {
            path: 'Scalar.md',
            extension: 'md',
            frontmatter,
            content: '#project details and #project/client next steps'
        }) as TFile & { frontmatter: { tags?: string | string[] }; content: string };

        cachedTagsByPath.set(file.path, ['project', 'project/client', 'other']);

        const fileManager = {
            processFrontMatter: vi.fn((_file: TFile, callback: (fm: Record<string, unknown>) => void) => {
                callback(file.frontmatter as unknown as Record<string, unknown>);
                return Promise.resolve();
            })
        };

        const vault = {
            getAbstractFileByPath: vi.fn((path: string) => (path === file.path ? file : null)),
            read: vi.fn(async () => file.content),
            modify: vi.fn(async (_file: TFile, data: string) => {
                file.content = data;
            }),
            process: vi.fn()
        };

        const provider = createSettingsProvider(settings);
        const metadataService = {
            getSettingsProvider: () => provider,
            handleTagDelete: vi.fn().mockResolvedValue(undefined)
        };

        const tagOperations = new TagOperations(
            { vault, fileManager } as unknown as App,
            () => settings,
            () => null,
            () => metadataService as any
        );

        const result = await (tagOperations as any).runTagDelete('project', [file.path]);

        expect(result).toBe(true);
        expect(fileManager.processFrontMatter).toHaveBeenCalled();
        expect(vault.read).toHaveBeenCalled();
        expect(vault.modify).toHaveBeenCalled();
        expect(file.frontmatter.tags).toBe('other');
        expect(file.content).not.toContain('#project');
        expect(file.content).not.toContain('#project/client');
        expect(metadataService.handleTagDelete).toHaveBeenCalledWith('project');
    });

    it('handles malformed tag separators when deleting tag hierarchies', async () => {
        const settings = createSettings();
        const frontmatter = {
            tags: ['project//client', 'project//client/research', 'other'],
            aliases: ['#project//client', '#project//client/research'],
            alias: '#project//client'
        };
        const file = Object.assign(new TFile(), {
            path: 'Client.md',
            extension: 'md',
            frontmatter,
            content: 'Meeting notes for #project//client.\nFollow-up tasks #project//client/research.'
        }) as TFile & {
            frontmatter: { tags?: string | string[]; aliases?: string | string[]; alias?: string };
            content: string;
        };

        cachedTagsByPath.set(file.path, ['project//client', 'project//client/research', 'other']);

        const fileManager = {
            processFrontMatter: vi.fn((_file: TFile, callback: (fm: Record<string, unknown>) => void) => {
                callback(file.frontmatter as unknown as Record<string, unknown>);
                return Promise.resolve();
            })
        };

        const vault = {
            getAbstractFileByPath: vi.fn((path: string) => (path === file.path ? file : null)),
            read: vi.fn(async () => file.content),
            modify: vi.fn(async (_file: TFile, data: string) => {
                file.content = data;
            }),
            process: vi.fn()
        };

        const provider = createSettingsProvider(settings);
        const metadataService = {
            getSettingsProvider: () => provider,
            handleTagDelete: vi.fn().mockResolvedValue(undefined)
        };

        const tagOperations = new TagOperations(
            { vault, fileManager } as unknown as App,
            () => settings,
            () => null,
            () => metadataService as any
        );

        const result = await (tagOperations as any).runTagDelete('project//client', [file.path]);

        expect(result).toBe(true);
        expect(fileManager.processFrontMatter).toHaveBeenCalled();
        expect(vault.read).toHaveBeenCalled();
        expect(vault.modify).toHaveBeenCalled();
        expect(file.frontmatter.tags).toEqual(['other']);
        expect(file.frontmatter.aliases).toBeUndefined();
        expect(file.frontmatter.alias).toBeUndefined();
        expect(file.content).not.toContain('#project//client');
        expect(file.content).not.toContain('#project//client/research');
        expect(metadataService.handleTagDelete).toHaveBeenCalledWith('project//client');
    });

    it('preserves hyphenated and underscored tags when deleting base inline tags', async () => {
        const settings = createSettings();
        const frontmatter = {
            tags: ['project', 'project/client', 'project-archive', 'project_2024']
        };
        const file = Object.assign(new TFile(), {
            path: 'Mixed.md',
            extension: 'md',
            frontmatter,
            content: 'Summary #project overview #project-archive tasks #project_2024 next #project/client wrap'
        }) as TFile & {
            frontmatter: { tags?: string | string[] };
            content: string;
        };

        cachedTagsByPath.set(file.path, ['project', 'project/client', 'project-archive', 'project_2024']);

        const fileManager = {
            processFrontMatter: vi.fn((_file: TFile, callback: (fm: Record<string, unknown>) => void) => {
                callback(file.frontmatter as unknown as Record<string, unknown>);
                return Promise.resolve();
            })
        };

        const vault = {
            getAbstractFileByPath: vi.fn((path: string) => (path === file.path ? file : null)),
            read: vi.fn(async () => file.content),
            modify: vi.fn(async (_file: TFile, data: string) => {
                file.content = data;
            }),
            process: vi.fn()
        };

        const provider = createSettingsProvider(settings);
        const metadataService = {
            getSettingsProvider: () => provider,
            handleTagDelete: vi.fn().mockResolvedValue(undefined)
        };

        const tagOperations = new TagOperations(
            { vault, fileManager } as unknown as App,
            () => settings,
            () => null,
            () => metadataService as any
        );

        const result = await (tagOperations as any).runTagDelete('project', [file.path]);

        expect(result).toBe(true);
        expect(file.frontmatter.tags).toEqual(['project-archive', 'project_2024']);
        expect(file.content).toContain('#project-archive');
        expect(file.content).toContain('#project_2024');
        expect(file.content).not.toContain('#project/client');
        expect(/#project(?![-_/])/u.test(file.content)).toBe(false);
        expect(metadataService.handleTagDelete).toHaveBeenCalledWith('project');
    });

    it('notifies listeners after successful tag delete', async () => {
        const settings = createSettings();
        const file = Object.assign(new TFile(), {
            path: 'Project.md',
            extension: 'md'
        });

        const vault = {
            getAbstractFileByPath: vi.fn(() => file)
        };

        const tagOperations = new TagOperations(
            { vault } as unknown as App,
            () => settings,
            () => null,
            () => null
        );

        vi.spyOn(tagOperations as any, 'deleteTagFromFile').mockResolvedValue(true);
        vi.spyOn(tagOperations as any, 'removeTagMetadataAfterDelete').mockResolvedValue(undefined);
        vi.spyOn(tagOperations as any, 'removeTagShortcutsAfterDelete').mockResolvedValue(undefined);

        const listener = vi.fn();
        const unsubscribe = tagOperations.addTagDeleteListener(listener);

        const result = await (tagOperations as any).runTagDelete('project', [file.path]);

        expect(result).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                canonicalPath: 'project',
                path: 'project'
            })
        );

        unsubscribe();
    });
});

describe('TagOperations tag rename workflow', () => {
    function createTagOperationsInstance(
        overrides: {
            settings?: NotebookNavigatorSettings;
            tagTree?: Partial<TagTreeService> | null;
            metadataService?: Partial<MetadataService> | null;
        } = {}
    ) {
        const settings = overrides.settings ?? createSettings();
        const tagTree = overrides.tagTree ?? null;
        const metadataService = overrides.metadataService ?? null;
        const app = { vault: {}, fileManager: {} } as unknown as App;

        return new TagOperations(
            app,
            () => settings,
            () => tagTree as TagTreeService | null,
            () => metadataService as MetadataService | null
        );
    }

    function createRenameTargets(count = 1): TagRenameModule.RenameFile[] {
        return Array.from({ length: count }, (_, index) => ({
            filePath: `Note-${index}.md`,
            renamed: vi.fn().mockResolvedValue(true)
        })) as unknown as TagRenameModule.RenameFile[];
    }

    it('rejects descendant rename requests', async () => {
        const tagOperations = createTagOperationsInstance();
        const executeSpy = vi.spyOn(tagOperations as any, 'executeRename');
        const metadataSpy = vi.spyOn(tagOperations as any, 'updateTagMetadataAfterRename');
        const shortcutsSpy = vi.spyOn(tagOperations as any, 'updateTagShortcutsAfterRename');

        const result = await (tagOperations as any).runTagRename('projects', 'projects/client', createRenameTargets());

        expect(result).toBe(false);
        expect(executeSpy).not.toHaveBeenCalled();
        expect(metadataSpy).not.toHaveBeenCalled();
        expect(shortcutsSpy).not.toHaveBeenCalled();
    });

    it('rejects renames that keep the same tag', async () => {
        const tagOperations = createTagOperationsInstance();
        const executeSpy = vi.spyOn(tagOperations as any, 'executeRename');

        const result = await (tagOperations as any).runTagRename('projects', 'projects', createRenameTargets());

        expect(result).toBe(false);
        expect(executeSpy).not.toHaveBeenCalled();
    });

    it('rejects renames with no target files', async () => {
        const tagOperations = createTagOperationsInstance();
        const executeSpy = vi.spyOn(tagOperations as any, 'executeRename');

        const result = await (tagOperations as any).runTagRename('projects', 'areas', []);

        expect(result).toBe(false);
        expect(executeSpy).not.toHaveBeenCalled();
    });

    it('aborts when rename produces no file updates', async () => {
        const tagOperations = createTagOperationsInstance();
        vi.spyOn(tagOperations as any, 'executeRename').mockResolvedValue({
            renamed: 0,
            total: 2
        });
        const metadataSpy = vi.spyOn(tagOperations as any, 'updateTagMetadataAfterRename');
        const shortcutsSpy = vi.spyOn(tagOperations as any, 'updateTagShortcutsAfterRename');

        const result = await (tagOperations as any).runTagRename('projects', 'areas', createRenameTargets(2));

        expect(result).toBe(false);
        expect(metadataSpy).not.toHaveBeenCalled();
        expect(shortcutsSpy).not.toHaveBeenCalled();
    });

    it('updates metadata and shortcuts after successful rename', async () => {
        const tagOperations = createTagOperationsInstance();
        vi.spyOn(tagOperations as any, 'executeRename').mockResolvedValue({
            renamed: 3,
            total: 3
        });
        const metadataSpy = vi.spyOn(tagOperations as any, 'updateTagMetadataAfterRename').mockResolvedValue(undefined);
        const shortcutsSpy = vi.spyOn(tagOperations as any, 'updateTagShortcutsAfterRename').mockResolvedValue(undefined);

        const result = await (tagOperations as any).runTagRename('projects', 'areas', createRenameTargets(3));

        expect(result).toBe(true);
        expect(metadataSpy).toHaveBeenCalledWith('projects', 'areas', false);
        expect(shortcutsSpy).toHaveBeenCalledWith('projects', 'areas');
    });

    it('notifies listeners after successful rename', async () => {
        const tagOperations = createTagOperationsInstance();
        vi.spyOn(tagOperations as any, 'executeRename').mockResolvedValue({
            renamed: 2,
            total: 2
        });
        vi.spyOn(tagOperations as any, 'updateTagMetadataAfterRename').mockResolvedValue(undefined);
        vi.spyOn(tagOperations as any, 'updateTagShortcutsAfterRename').mockResolvedValue(undefined);

        const listener = vi.fn();
        const unsubscribe = tagOperations.addTagRenameListener(listener);

        const result = await (tagOperations as any).runTagRename('projects/client', 'areas/client', createRenameTargets(2));

        expect(result).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({
                oldCanonicalPath: 'projects/client',
                newCanonicalPath: 'areas/client',
                mergedIntoExisting: false
            })
        );

        unsubscribe();
    });
});

describe('TagOperations drag-based tag renames', () => {
    function createTagOperationsInstance() {
        const settings = createSettings();
        const app = { vault: {}, fileManager: {} } as unknown as App;
        return new TagOperations(
            app,
            () => settings,
            () => null,
            () => null
        );
    }

    it('promotes nested tags to root leaf name', async () => {
        const tagOperations = createTagOperationsInstance();
        vi.spyOn(tagOperations as any, 'resolveDisplayTagPath').mockImplementation((path: string) => {
            if (path === 'sourceTag') {
                return 'projects/client';
            }
            return path;
        });
        const renameSpy = vi.spyOn(tagOperations as any, 'runTagRename').mockResolvedValue(true);

        await tagOperations.promoteTagToRoot('sourceTag');

        expect(renameSpy).toHaveBeenCalledWith('projects/client', 'client');
    });

    it('skips promotion when tag already at root', async () => {
        const tagOperations = createTagOperationsInstance();
        vi.spyOn(tagOperations as any, 'resolveDisplayTagPath').mockReturnValue('projects');
        const renameSpy = vi.spyOn(tagOperations as any, 'runTagRename').mockResolvedValue(true);

        await tagOperations.promoteTagToRoot('projects');

        expect(renameSpy).not.toHaveBeenCalled();
    });

    it('renames dragged tag under target hierarchy', async () => {
        const tagOperations = createTagOperationsInstance();
        vi.spyOn(tagOperations as any, 'resolveDisplayTagPath').mockImplementation((path: string) => {
            if (path === 'sourceTag') {
                return 'projects/client';
            }
            if (path === 'targetTag') {
                return 'areas';
            }
            return path;
        });
        const renameSpy = vi.spyOn(tagOperations as any, 'runTagRename').mockResolvedValue(true);

        await tagOperations.renameTagByDrag('sourceTag', 'targetTag');

        expect(renameSpy).toHaveBeenCalledWith('projects/client', 'areas/client');
    });

    it('renames dragged tag to root when dropping on empty target', async () => {
        const tagOperations = createTagOperationsInstance();
        vi.spyOn(tagOperations as any, 'resolveDisplayTagPath').mockImplementation((path: string) => {
            if (path === 'sourceTag') {
                return 'projects/client';
            }
            if (path === 'targetTag') {
                return '';
            }
            return path;
        });
        const renameSpy = vi.spyOn(tagOperations as any, 'runTagRename').mockResolvedValue(true);

        await tagOperations.renameTagByDrag('sourceTag', 'targetTag');

        expect(renameSpy).toHaveBeenCalledWith('projects/client', 'client');
    });

    it('skips drag rename when target is virtual tag collection', async () => {
        const tagOperations = createTagOperationsInstance();
        const resolveSpy = vi.spyOn(tagOperations as any, 'resolveDisplayTagPath');
        const renameSpy = vi.spyOn(tagOperations as any, 'runTagRename').mockResolvedValue(true);

        await tagOperations.renameTagByDrag('sourceTag', TAGGED_TAG_ID);

        expect(resolveSpy).not.toHaveBeenCalled();
        expect(renameSpy).not.toHaveBeenCalled();
    });
});
