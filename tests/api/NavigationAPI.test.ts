import { describe, it, expect, vi } from 'vitest';
import { NavigationAPI } from '../../src/api/modules/NavigationAPI';
import { TFolder } from 'obsidian';

describe('NavigationAPI', () => {
    it('navigates to a folder via the navigator view', async () => {
        const view = {
            navigateToFile: vi.fn(),
            navigateToFolder: vi.fn(),
            navigateToTag: vi.fn()
        };

        const folder = new TFolder();
        folder.path = 'Projects';
        const resolvedFolder = new TFolder();
        resolvedFolder.path = 'Projects';

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFolderByPath: (path: string) => (path === folder.path ? resolvedFolder : null)
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await navigationAPI.navigateToFolder(folder);

        expect(view.navigateToFolder).toHaveBeenCalledWith(resolvedFolder, { preserveNavigationFocus: true });
    });

    it('skips navigation when the folder does not resolve', async () => {
        const view = {
            navigateToFile: vi.fn(),
            navigateToFolder: vi.fn(),
            navigateToTag: vi.fn()
        };

        const folder = new TFolder();
        folder.path = 'Missing';

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFolderByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await navigationAPI.navigateToFolder(folder);

        expect(view.navigateToFolder).not.toHaveBeenCalled();
    });

    it('navigates to a tag via the navigator view', async () => {
        const view = {
            navigateToFile: vi.fn(),
            navigateToFolder: vi.fn(),
            navigateToTag: vi.fn()
        };

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFolderByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await navigationAPI.navigateToTag('#work');

        expect(view.navigateToTag).toHaveBeenCalledWith('#work');
    });

    it('finds the navigator view when multiple leaves exist', async () => {
        const view = {
            navigateToFile: vi.fn(),
            navigateToFolder: vi.fn(),
            navigateToTag: vi.fn()
        };

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFolderByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => [{ view: {} }, { view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await navigationAPI.navigateToTag('#work');

        expect(view.navigateToTag).toHaveBeenCalledWith('#work');
    });
});
