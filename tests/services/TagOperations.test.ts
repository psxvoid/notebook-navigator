import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TagDescriptor, TagReplacement, isDescendantRename } from '../../src/services/tagRename/TagRenameEngine';
import { TagOperations } from '../../src/services/TagOperations';
import { ShortcutType } from '../../src/types/shortcuts';
import type { NotebookNavigatorSettings } from '../../src/settings';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { ISettingsProvider } from '../../src/interfaces/ISettingsProvider';

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
        normalizePath: (path: string) => path
    };
});

function createSettings(): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        shortcuts: []
    };
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

describe('TagDescriptor', () => {
    it('normalizes canonical form while preserving display casing', () => {
        const descriptor = new TagDescriptor('Projects/Archive/');
        expect(descriptor.tag).toBe('#Projects/Archive/');
        expect(descriptor.canonical).toBe('#projects/archive');
        expect(descriptor.canonicalName).toBe('projects/archive');
    });

    it('matches descendants regardless of hash or casing', () => {
        const descriptor = new TagDescriptor('#Projects');
        expect(descriptor.matches('projects')).toBe(true);
        expect(descriptor.matches('Projects/Archive')).toBe(true);
        expect(descriptor.matches('#projects/archive')).toBe(true);
    });
});

describe('isDescendantRename', () => {
    it('returns true when the new tag is within the original hierarchy', () => {
        const original = new TagDescriptor('Projects');
        const descendant = new TagDescriptor('Projects/Archive');
        expect(isDescendantRename(original, descendant)).toBe(true);
    });

    it('returns false for unrelated or sibling tags', () => {
        const original = new TagDescriptor('Projects');
        const sibling = new TagDescriptor('ProjectsArchive');
        expect(isDescendantRename(original, sibling)).toBe(false);
    });
});

describe('TagReplacement', () => {
    it('renames lowercase frontmatter tags without hashes', () => {
        const replacement = new TagReplacement(new TagDescriptor('Projects'), new TagDescriptor('Areas'));
        const [updated] = replacement.inArray(['projects'], false, false) as string[];
        expect(updated).toBe('Areas');
    });

    it('renames lowercase tags with descendants', () => {
        const replacement = new TagReplacement(new TagDescriptor('Projects'), new TagDescriptor('Areas'));
        const [updated] = replacement.inArray(['projects/archive'], false, false) as string[];
        expect(updated).toBe('Areas/archive');
    });

    it('detects collisions when renamed tag already exists', () => {
        const replacement = new TagReplacement(new TagDescriptor('Projects'), new TagDescriptor('Areas'));
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
        settings.shortcuts = [
            { type: ShortcutType.TAG, tagPath: 'projects' },
            { type: ShortcutType.NOTE, path: 'Notes.md' },
            { type: ShortcutType.TAG, tagPath: 'projects/client' }
        ];
        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).updateTagShortcutsAfterRename('projects', 'areas');

        expect(settings.shortcuts).toEqual([
            { type: ShortcutType.TAG, tagPath: 'areas' },
            { type: ShortcutType.NOTE, path: 'Notes.md' },
            { type: ShortcutType.TAG, tagPath: 'areas/client' }
        ]);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('drops shortcuts when rename collides with existing destination', async () => {
        const settings = createSettings();
        settings.shortcuts = [
            { type: ShortcutType.TAG, tagPath: 'areas' },
            { type: ShortcutType.TAG, tagPath: 'projects' }
        ];
        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).updateTagShortcutsAfterRename('projects', 'areas');

        expect(settings.shortcuts).toEqual([{ type: ShortcutType.TAG, tagPath: 'areas' }]);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('leaves shortcuts untouched when new path matches old path after normalization', async () => {
        const settings = createSettings();
        settings.shortcuts = [{ type: ShortcutType.TAG, tagPath: 'projects' }];
        const { tagOperations, provider } = createTagOperations(settings);

        await (tagOperations as any).updateTagShortcutsAfterRename('Projects', 'projects');

        expect(settings.shortcuts).toEqual([{ type: ShortcutType.TAG, tagPath: 'projects' }]);
        expect(provider.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });
});
