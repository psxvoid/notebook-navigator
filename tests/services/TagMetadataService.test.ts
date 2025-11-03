import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TagMetadataService } from '../../src/services/metadata/TagMetadataService';
import type { NotebookNavigatorSettings } from '../../src/settings';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { ISettingsProvider } from '../../src/interfaces/ISettingsProvider';

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
}

function createSettings(): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        tagColors: {},
        tagBackgroundColors: {},
        tagIcons: {},
        tagSortOverrides: {},
        tagAppearances: {}
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
});
