import { describe, expect, it } from 'vitest';
import type { NotebookNavigatorSettings } from '../../src/settings/types';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import {
    getActiveFileVisibility,
    getActiveHiddenFiles,
    getActiveHiddenFolders,
    getActiveHiddenTags,
    getActiveVaultProfile,
    getHiddenFolderMatcher,
    normalizeHiddenFolderPath,
    removeHiddenTagPrefixMatches,
    removeHiddenFolderExactMatches,
    updateHiddenTagPrefixMatches,
    updateHiddenFolderExactMatches
} from '../../src/utils/vaultProfiles';

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
                hiddenFolders: ['/Projects/*', '/Notes/Archive*']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects', '/Areas');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas/*', '/Notes/Archive*']);
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

    it('renames descendant wildcard patterns when a parent folder changes', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects', '/Projects/Client/*', '/Archive']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects', '/Areas');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas', '/Areas/Client/*', '/Archive']);
    });

    it('renames mid-segment wildcard patterns when the leading segment changes', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*/Archive']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects', '/Areas');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas/*/Archive']);
    });

    it('renames mid-segment wildcard patterns when a deeper child is renamed', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*/Archive']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects/Client', '/Areas/Client');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas/*/Archive']);
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

    it('removes descendant wildcard entries when a parent folder is deleted', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects', '/Projects/Client/*', '/Keep']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, '/Projects');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Keep']);
    });

    it('keeps mid-segment wildcard patterns when deleting a matched child path', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*/Archive']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, '/Projects/Client/Archive');

        expect(didRemove).toBe(false);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Projects/*/Archive']);
    });
});

describe('hidden tag pattern updates', () => {
    it('does not rewrite name-based wildcard patterns', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['draft*', '*archived', 'projects']
            },
            {
                ...baseProfile,
                id: 'profile-b',
                hiddenTags: ['draft*', '*archived', 'misc']
            }
        ];

        const didUpdate = updateHiddenTagPrefixMatches(settings, 'draft', 'review');

        expect(didUpdate).toBe(false);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenTags).toEqual(['draft*', '*archived', 'projects']);
        expect(settings.vaultProfiles.find(profile => profile.id === 'profile-b')?.hiddenTags).toEqual(['draft*', '*archived', 'misc']);
    });

    it('keeps name-based wildcard patterns when deleting a tag', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['*draft', 'draft*', 'keep']
            },
            {
                ...baseProfile,
                id: 'profile-b',
                hiddenTags: ['*draft', 'other']
            }
        ];

        const didRemove = removeHiddenTagPrefixMatches(settings, 'draft');

        expect(didRemove).toBe(false);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenTags).toEqual(['*draft', 'draft*', 'keep']);
        expect(settings.vaultProfiles.find(profile => profile.id === 'profile-b')?.hiddenTags).toEqual(['*draft', 'other']);
    });

    it('rewrites descendant path rules ending with /* on rename', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['projects', 'projects/*', 'projects/client/design']
            }
        ];

        const didUpdate = updateHiddenTagPrefixMatches(settings, 'projects', 'areas');

        expect(didUpdate).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenTags).toEqual(['areas', 'areas/*', 'areas/client/design']);
    });

    it('renames mid-segment wildcard tag rules when the leading segment changes', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['projects/*/drafts']
            }
        ];

        const didUpdate = updateHiddenTagPrefixMatches(settings, 'projects', 'areas');

        expect(didUpdate).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenTags).toEqual(['areas/*/drafts']);
    });

    it('renames mid-segment wildcard tag rules when a deeper child is renamed', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['projects/*/drafts']
            }
        ];

        const didUpdate = updateHiddenTagPrefixMatches(settings, 'projects/client', 'areas/client');

        expect(didUpdate).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenTags).toEqual(['areas/*/drafts']);
    });

    it('removes descendant path rules ending with /* on delete', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['projects/*', 'projects/client/design', 'draft*']
            }
        ];

        const didRemove = removeHiddenTagPrefixMatches(settings, 'projects');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenTags).toEqual(['draft*']);
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

describe('vault profile selectors', () => {
    it('returns existing profile references without cloning', () => {
        const settings = createSettings();
        const activeProfile = getActiveVaultProfile(settings);

        expect(activeProfile).toBe(settings.vaultProfiles[0]);
        expect(getActiveHiddenFolders(settings)).toBe(settings.vaultProfiles[0].hiddenFolders);
        expect(getActiveHiddenFiles(settings)).toBe(settings.vaultProfiles[0].hiddenFiles);
        expect(getActiveHiddenTags(settings)).toBe(settings.vaultProfiles[0].hiddenTags);
        expect(getActiveFileVisibility(settings)).toBe(settings.vaultProfiles[0].fileVisibility);
    });
});

describe('hidden folder matcher', () => {
    it('matches mid-segment wildcard paths and descendants', () => {
        const matcher = getHiddenFolderMatcher(['/Projects/*/Archive']);

        expect(matcher.matches('/Projects/Client/Archive')).toBe(true);
        expect(matcher.matches('/Projects/Client/Archive/Deep')).toBe(true);
        expect(matcher.matches('/Projects/Archive')).toBe(false);
    });

    it('matches trailing wildcard patterns against the base path', () => {
        const matcher = getHiddenFolderMatcher(['/Projects/*']);

        expect(matcher.matches('/Projects')).toBe(false);
        expect(matcher.matches('/Projects/Client')).toBe(true);
    });
});
