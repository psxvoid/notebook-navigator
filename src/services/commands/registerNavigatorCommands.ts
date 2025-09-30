/*
 * Notebook Navigator - Plugin for Obsidian
 */

import type NotebookNavigatorPlugin from '../../main';
import { NOTEBOOK_NAVIGATOR_VIEW } from '../../types';
import { strings } from '../../i18n';
import { NotebookNavigatorView } from '../../view/NotebookNavigatorView';

function focusNavigatorFilePane(plugin: NotebookNavigatorPlugin) {
    const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
    if (navigatorLeaves.length > 0) {
        const leaf = navigatorLeaves[0];
        plugin.app.workspace.revealLeaf(leaf);
        const view = leaf.view;
        if (view instanceof NotebookNavigatorView) {
            view.focusFilePane();
        }
    }
}

async function ensureNavigatorOpen(plugin: NotebookNavigatorPlugin) {
    const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
    if (navigatorLeaves.length > 0) {
        plugin.app.workspace.revealLeaf(navigatorLeaves[0]);
        return navigatorLeaves[0];
    }

    return plugin.activateView();
}

export default function registerNavigatorCommands(plugin: NotebookNavigatorPlugin): void {
    plugin.addCommand({
        id: 'open',
        name: strings.commands.open,
        callback: async () => {
            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            if (navigatorLeaves.length > 0) {
                plugin.app.workspace.revealLeaf(navigatorLeaves[0]);
                focusNavigatorFilePane(plugin);
            } else {
                await plugin.activateView();
            }
        }
    });

    plugin.addCommand({
        id: 'open-homepage',
        name: strings.commands.openHomepage,
        checkCallback: (checking: boolean) => {
            const homepageFile = plugin.resolveHomepageFile();
            if (!homepageFile) {
                return false;
            }

            if (!checking) {
                void plugin.openHomepage('command', true);
            }

            return true;
        }
    });

    plugin.addCommand({
        id: 'reveal-file',
        name: strings.commands.revealFile,
        checkCallback: (checking: boolean) => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (activeFile && activeFile.parent) {
                if (!checking) {
                    void (async () => {
                        await plugin.activateView();
                        await plugin.revealFileInActualFolder(activeFile);
                    })();
                }
                return true;
            }
            return false;
        }
    });

    plugin.addCommand({
        id: 'toggle-descendants',
        name: strings.commands.toggleDescendants,
        callback: async () => {
            await plugin.activateView();
            plugin.settings.includeDescendantNotes = !plugin.settings.includeDescendantNotes;
            await plugin.saveSettingsAndUpdate();
        }
    });

    plugin.addCommand({
        id: 'toggle-hidden',
        name: strings.commands.toggleHidden,
        callback: async () => {
            await plugin.activateView();
            plugin.settings.showHiddenItems = !plugin.settings.showHiddenItems;
            await plugin.saveSettingsAndUpdate();
        }
    });

    plugin.addCommand({
        id: 'toggle-dual-pane',
        name: strings.commands.toggleDualPane,
        callback: async () => {
            await plugin.activateView();
            plugin.toggleDualPanePreference();
        }
    });

    plugin.addCommand({
        id: 'collapse-expand',
        name: strings.commands.collapseExpand,
        callback: async () => {
            await plugin.activateView();

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    view.triggerCollapse();
                    break;
                }
            }
        }
    });

    plugin.addCommand({
        id: 'new-note',
        name: strings.commands.createNewNote,
        callback: async () => {
            await plugin.activateView();

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    await view.createNoteInSelectedFolder();
                    break;
                }
            }
        }
    });

    plugin.addCommand({
        id: 'move-files',
        name: strings.commands.moveFiles,
        callback: async () => {
            await plugin.activateView();

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    await view.moveSelectedFiles();
                    break;
                }
            }
        }
    });

    plugin.addCommand({
        id: 'delete-files',
        name: strings.commands.deleteFile,
        callback: async () => {
            await plugin.activateView();

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            navigatorLeaves.forEach(leaf => {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    view.deleteActiveFile();
                }
            });
        }
    });

    plugin.addCommand({
        id: 'rebuild-cache',
        name: strings.commands.rebuildCache,
        callback: async () => {
            try {
                await plugin.rebuildCache();
            } catch (error) {
                console.error('Failed to rebuild cache:', error);
            }
        }
    });

    plugin.addCommand({
        id: 'add-tag',
        name: strings.commands.addTag,
        callback: async () => {
            await plugin.activateView();

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    await view.addTagToSelectedFiles();
                    break;
                }
            }
        }
    });

    plugin.addCommand({
        id: 'remove-tag',
        name: strings.commands.removeTag,
        callback: async () => {
            await plugin.activateView();

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    await view.removeTagFromSelectedFiles();
                    break;
                }
            }
        }
    });

    plugin.addCommand({
        id: 'remove-all-tags',
        name: strings.commands.removeAllTags,
        callback: async () => {
            await plugin.activateView();

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    await view.removeAllTagsFromSelectedFiles();
                    break;
                }
            }
        }
    });

    plugin.addCommand({
        id: 'navigate-to-folder',
        name: strings.commands.navigateToFolder,
        callback: async () => {
            await plugin.activateView();

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    await view.navigateToFolderWithModal();
                    break;
                }
            }
        }
    });

    plugin.addCommand({
        id: 'navigate-to-tag',
        name: strings.commands.navigateToTag,
        callback: async () => {
            await plugin.activateView();

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    await view.navigateToTagWithModal();
                    break;
                }
            }
        }
    });

    plugin.addCommand({
        id: 'search',
        name: strings.commands.search,
        callback: async () => {
            await ensureNavigatorOpen(plugin);

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    view.toggleSearch();
                    break;
                }
            }
        }
    });
}
