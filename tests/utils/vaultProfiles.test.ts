import { describe, expect, it } from 'vitest';
import type { NotebookNavigatorSettings } from '../../src/settings/types';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { normalizeHiddenFolderPath, removeHiddenFolderExactMatches, updateHiddenFolderExactMatches } from '../../src/utils/vaultProfiles';

function createSettings(): NotebookNavigatorSettings {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as NotebookNavigatorSettings;
}

describe('updateHiddenFolderExactMatches', () => {
    it('renames exact path matches across every vault profile', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/Archive', '/Reports/*', 'Archive']
            },
            {
                ...baseProfile,
                id: 'profile-b',
                hiddenFolders: ['/Projects/Archive/', '/Other']
            }
        ];
        settings.vaultProfile = 'default';

        const didChange = updateHiddenFolderExactMatches(settings, 'Projects/Archive', 'Areas/Archive');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenFolders).toEqual([
            '/Areas/Archive',
            '/Reports/*',
            'Archive'
        ]);
        expect(settings.vaultProfiles.find(profile => profile.id === 'profile-b')?.hiddenFolders).toEqual(['/Areas/Archive', '/Other']);
    });

    it('returns false when no perfect match exists', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Design/*', 'Archive']
            }
        ];
        settings.vaultProfile = 'default';

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects/Archive', '/Projects/Renamed');

        expect(didChange).toBe(false);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenFolders).toEqual(['/Design/*', 'Archive']);
    });

    it('renames wildcard patterns that match the folder prefix', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*', '/Notes/*/Archive']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects', '/Areas');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas/*', '/Notes/*/Archive']);
    });

    it('renames nested wildcard patterns when the prefix matches exactly', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/Archive/*', '/Projects/*']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects/Archive', '/Projects/Archives');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Projects/Archives/*', '/Projects/*']);
    });
});

describe('removeHiddenFolderExactMatches', () => {
    it('removes exact path matches across every vault profile', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/Archive', '/Reports/*', 'Archive']
            },
            {
                ...baseProfile,
                id: 'profile-b',
                hiddenFolders: ['/Projects/Archive/', '/Other']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, 'Projects/Archive');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenFolders).toEqual(['/Reports/*', 'Archive']);
        expect(settings.vaultProfiles.find(profile => profile.id === 'profile-b')?.hiddenFolders).toEqual(['/Other']);
    });

    it('returns false when no perfect match exists to remove', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Design/*', 'Archive']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, '/Projects/Archive');

        expect(didRemove).toBe(false);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenFolders).toEqual(['/Design/*', 'Archive']);
    });

    it('removes wildcard entries whose prefix matches the deleted folder', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*', '/Projects/Archive/*']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, '/Projects/Archive');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Projects/*']);
    });
});

describe('normalizeHiddenFolderPath', () => {
    it('adds leading slash and trims trailing slash', () => {
        expect(normalizeHiddenFolderPath('folder/subdir/')).toBe('/folder/subdir');
    });

    it('preserves vault root and empty values', () => {
        expect(normalizeHiddenFolderPath('/')).toBe('/');
        expect(normalizeHiddenFolderPath('')).toBe('');
    });
});
