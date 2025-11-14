import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetadataAPI } from '../../src/api/modules/MetadataAPI';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorAPI } from '../../src/api/NotebookNavigatorAPI';
import type { NotebookNavigatorSettings } from '../../src/settings';
import type { IconString } from '../../src/api/types';
import type { TFolder } from 'obsidian';

describe('MetadataAPI icon normalization', () => {
    let plugin: {
        settings: NotebookNavigatorSettings;
        saveSettingsAndUpdate: ReturnType<typeof vi.fn>;
    };
    let api: NotebookNavigatorAPI;

    beforeEach(() => {
        plugin = {
            settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
            saveSettingsAndUpdate: vi.fn().mockResolvedValue(undefined)
        };

        api = {
            getPlugin: () => plugin,
            getApp: () =>
                ({
                    vault: {
                        getFolderByPath: () => null
                    }
                }) as unknown,
            trigger: vi.fn()
        } as unknown as NotebookNavigatorAPI;
    });

    it('normalizes legacy lucide identifiers provided through the API', async () => {
        const metadataAPI = new MetadataAPI(api);
        const folder = { path: 'Folder' } as TFolder;

        await metadataAPI.setFolderMeta(folder, {
            icon: 'lucide-sun' as unknown as IconString
        });

        expect(plugin.settings.folderIcons.Folder).toBe('sun');
        expect(plugin.saveSettingsAndUpdate).toHaveBeenCalled();
    });

    it('normalizes provider-prefixed identifiers provided through the API', async () => {
        const metadataAPI = new MetadataAPI(api);
        const folder = { path: 'Folder' } as TFolder;

        await metadataAPI.setFolderMeta(folder, {
            icon: 'phosphor:ph-apple-logo' as IconString
        });

        expect(plugin.settings.folderIcons.Folder).toBe('phosphor:apple-logo');
    });
});
