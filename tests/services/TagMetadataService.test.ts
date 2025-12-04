import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TagMetadataService } from '../../src/services/metadata/TagMetadataService';
import type { NotebookNavigatorSettings } from '../../src/settings';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { ISettingsProvider } from '../../src/interfaces/ISettingsProvider';
import { createVaultProfile } from '../../src/utils/vaultProfiles';
import { mockObsidian } from 'tests/stubs/obsidian';

mockObsidian()

class TestSettingsProvider implements ISettingsProvider {
    constructor(public settings: NotebookNavigatorSettings) {}

    saveSettingsAndUpdate = vi.fn().mockResolvedValue(undefined);

    notifySettingsUpdate(): void {}

    getRecentNotes(): string[] {
        return [];
    }

    setRecentNotes(): void {}

    getRecentIcons(): Record<string, string[]> {
        return {};
    }

    setRecentIcons(): void {}

    getRecentColors(): string[] {
        return [];
    }

    setRecentColors(): void {}
}

function createSettings(): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        tagColors: {},
        tagBackgroundColors: {},
        tagIcons: {},
        tagSortOverrides: {},
        tagAppearances: {},
        vaultProfiles: DEFAULT_SETTINGS.vaultProfiles.map(profile => ({
            ...profile,
            hiddenFolders: [...profile.hiddenFolders],
            hiddenFiles: [...profile.hiddenFiles],
            hiddenTags: [...profile.hiddenTags],
            shortcuts: [...profile.shortcuts]
        }))
    };
}

describe('TagMetadataService.handleTagRename', () => {
    const appStub = {} as unknown as App;

    it('moves metadata when destination tag has no existing entries', async () => {
        const settings = createSettings();
        settings.tagColors = { project: '#ff0000' };
        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagRename('project', 'areas', false);

        expect(settings.tagColors.project).toBeUndefined();
        expect(settings.tagColors.areas).toBe('#ff0000');
    });

    it('preserves destination metadata when renaming into an existing tag', async () => {
        const settings = createSettings();
        settings.tagColors = { project: '#ff0000', areas: '#00ff00' };
        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagRename('project', 'areas', true);

        expect(settings.tagColors.project).toBeUndefined();
        expect(settings.tagColors.areas).toBe('#00ff00');
    });

    it('retains descendant metadata on destination tags while removing legacy entries', async () => {
        const settings = createSettings();
        settings.tagIcons = { 'project/demo': 'lucide-circle' };
        settings.tagBackgroundColors = { 'project/design': '#123456' };
        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagRename('project', 'areas', true);

        expect(settings.tagIcons['project/demo']).toBeUndefined();
        expect(settings.tagIcons['areas/demo']).toBe('lucide-circle');
        expect(settings.tagBackgroundColors['project/design']).toBeUndefined();
        expect(settings.tagBackgroundColors['areas/design']).toBe('#123456');
    });

    it('updates hidden tags across profiles on rename', async () => {
        const settings = createSettings();
        const activeProfile = settings.vaultProfiles[0];
        activeProfile.hiddenTags = ['projects', 'misc'];
        settings.vaultProfiles.push(
            createVaultProfile('secondary', {
                id: 'secondary',
                hiddenTags: ['projects/client', '*draft']
            })
        );

        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagRename('projects', 'areas');

        expect(activeProfile.hiddenTags).toEqual(['areas', 'misc']);
        expect(settings.vaultProfiles[1].hiddenTags).toEqual(['areas/client', '*draft']);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('updates descendant wildcard tag rules ending with /* on rename', async () => {
        const settings = createSettings();
        const activeProfile = settings.vaultProfiles[0];
        activeProfile.hiddenTags = ['projects/*', 'projects/client'];
        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagRename('projects', 'areas');

        expect(activeProfile.hiddenTags).toEqual(['areas/*', 'areas/client']);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('updates mid-segment wildcard tag patterns during rename', async () => {
        const settings = createSettings();
        const activeProfile = settings.vaultProfiles[0];
        activeProfile.hiddenTags = ['projects/*/drafts', 'temp*', '*draft'];
        settings.vaultProfiles.push(
            createVaultProfile('secondary', {
                id: 'secondary',
                hiddenTags: ['projects/research*', 'keep']
            })
        );

        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagRename('projects', 'areas');

        expect(activeProfile.hiddenTags).toEqual(['areas/*/drafts', 'temp*', '*draft']);
        expect(settings.vaultProfiles[1].hiddenTags).toEqual(['areas/research*', 'keep']);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('does not rewrite name-based wildcard patterns on rename', async () => {
        const settings = createSettings();
        const activeProfile = settings.vaultProfiles[0];
        activeProfile.hiddenTags = ['draft*', '*review', 'keep'];
        settings.vaultProfiles.push(
            createVaultProfile('secondary', {
                id: 'secondary',
                hiddenTags: ['*review', 'draft*', 'misc']
            })
        );

        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagRename('draft', 'approved');

        expect(activeProfile.hiddenTags).toEqual(['draft*', '*review', 'keep']);
        expect(settings.vaultProfiles[1].hiddenTags).toEqual(['*review', 'draft*', 'misc']);
        expect(provider.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });
});

describe('TagMetadataService.handleTagDelete', () => {
    const appStub = {} as unknown as App;

    it('removes metadata and hidden tags for deleted hierarchy', async () => {
        const settings = createSettings();
        settings.tagColors = { project: '#ff0000', other: '#00ff00' };
        settings.tagIcons = { 'project/archive': 'lucide-archive' };
        const activeProfile = settings.vaultProfiles[0];
        activeProfile.hiddenTags = ['project', 'archive'];
        settings.vaultProfiles.push(
            createVaultProfile('secondary', {
                id: 'secondary',
                hiddenTags: ['project/client']
            })
        );
        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagDelete('project');

        expect(settings.tagColors).toEqual({ other: '#00ff00' });
        expect(settings.tagIcons).toEqual({});
        expect(activeProfile.hiddenTags).toEqual(['archive']);
        expect(settings.vaultProfiles[1].hiddenTags).toEqual([]);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('skips work when no metadata matches deleted tag', async () => {
        const settings = createSettings();
        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagDelete('project');

        expect(provider.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });

    it('removes mid-segment wildcard hidden tag patterns on delete when the literal prefix matches', async () => {
        const settings = createSettings();
        const activeProfile = settings.vaultProfiles[0];
        activeProfile.hiddenTags = ['projects/*/drafts', 'keep*', '*draft'];
        settings.vaultProfiles.push(
            createVaultProfile('secondary', {
                id: 'secondary',
                hiddenTags: ['projects/research*', 'misc']
            })
        );

        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagDelete('projects');

        expect(activeProfile.hiddenTags).toEqual(['keep*', '*draft']);
        expect(settings.vaultProfiles[1].hiddenTags).toEqual(['misc']);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('removes descendant wildcard hidden tag rules ending with /* on delete', async () => {
        const settings = createSettings();
        const activeProfile = settings.vaultProfiles[0];
        activeProfile.hiddenTags = ['projects/*', 'projects/client', 'keep'];
        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagDelete('projects');

        expect(activeProfile.hiddenTags).toEqual(['keep']);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('keeps name-based wildcard hidden tag patterns on delete', async () => {
        const settings = createSettings();
        const activeProfile = settings.vaultProfiles[0];
        activeProfile.hiddenTags = ['draft*', '*draft', 'keep'];
        settings.vaultProfiles.push(
            createVaultProfile('secondary', {
                id: 'secondary',
                hiddenTags: ['*draft', 'draft*', 'other']
            })
        );

        const provider = new TestSettingsProvider(settings);
        const service = new TagMetadataService(appStub, provider, () => null);

        await service.handleTagDelete('draft');

        expect(activeProfile.hiddenTags).toEqual(['draft*', '*draft', 'keep']);
        expect(settings.vaultProfiles[1].hiddenTags).toEqual(['*draft', 'draft*', 'other']);
        expect(provider.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });
});
