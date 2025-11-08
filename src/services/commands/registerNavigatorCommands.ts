/*
 * Notebook Navigator - Plugin for Obsidian
 */

import { Notice, TFile, TFolder } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { NOTEBOOK_NAVIGATOR_VIEW } from '../../types';
import { strings } from '../../i18n';
import { isFolderNote, isSupportedFolderNoteExtension } from '../../utils/folderNotes';
import { isFolderInExcludedFolder, shouldExcludeFile } from '../../utils/fileFilters';
import { getEffectiveFrontmatterExclusions, isFileHiddenBySettings } from '../../utils/exclusionUtils';
import { NotebookNavigatorView } from '../../view/NotebookNavigatorView';
import { CacheRebuildMode } from '../../main';

/**
 * Reveals the navigator view and focuses whichever pane is currently visible
 * @param plugin - The plugin instance
 */
function focusNavigatorVisiblePane(plugin: NotebookNavigatorPlugin) {
    const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
    if (navigatorLeaves.length > 0) {
        const leaf = navigatorLeaves[0];
        plugin.app.workspace.revealLeaf(leaf);
        const view = leaf.view;
        if (view instanceof NotebookNavigatorView) {
            view.focusVisiblePane();
        }
    }
}

/**
 * Opens the navigator view if not already open, otherwise reveals the existing view
 * @param plugin - The plugin instance
 * @returns The workspace leaf containing the navigator view
 */
async function ensureNavigatorOpen(plugin: NotebookNavigatorPlugin) {
    const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
    if (navigatorLeaves.length > 0) {
        plugin.app.workspace.revealLeaf(navigatorLeaves[0]);
        return navigatorLeaves[0];
    }

    return plugin.activateView();
}

/**
 * Registers all navigator commands with the plugin
 */
export default function registerNavigatorCommands(plugin: NotebookNavigatorPlugin): void {
    // Command to open the navigator or focus it if already open
    plugin.addCommand({
        id: 'open',
        name: strings.commands.open,
        callback: async () => {
            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            if (navigatorLeaves.length > 0) {
                focusNavigatorVisiblePane(plugin);
            } else {
                await plugin.activateView();
            }
        }
    });

    // Command to open the configured homepage file
    plugin.addCommand({
        id: 'open-homepage',
        name: strings.commands.openHomepage,
        checkCallback: (checking: boolean) => {
            const homepageFile = plugin.resolveHomepageFile();
            if (!homepageFile) {
                return false;
            }

            if (!checking) {
                void plugin.openHomepage('command');
            }

            return true;
        }
    });

    // Command to reveal the currently active file in the navigator
    plugin.addCommand({
        id: 'reveal-file',
        name: strings.commands.revealFile,
        checkCallback: (checking: boolean) => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (activeFile && activeFile.parent) {
                if (!checking) {
                    void (async () => {
                        await plugin.activateView();
                        if (isFileHiddenBySettings(activeFile, plugin.settings, plugin.app, plugin.getUXPreferences().showHiddenItems)) {
                            new Notice(strings.fileSystem.notifications.hiddenFileReveal);
                        }
                        await plugin.revealFileInActualFolder(activeFile);
                    })();
                }
                return true;
            }
            return false;
        }
    });

    // Command to toggle showing descendant files in folders
    plugin.addCommand({
        id: 'toggle-descendants',
        name: strings.commands.toggleDescendants,
        callback: async () => {
            await plugin.activateView();
            plugin.toggleIncludeDescendantNotes();
        }
    });

    // Command to toggle showing hidden files and folders
    plugin.addCommand({
        id: 'toggle-hidden',
        name: strings.commands.toggleHidden,
        callback: async () => {
            await plugin.activateView();
            plugin.toggleShowHiddenItems();
        }
    });

    // Command to toggle between alphabetical and frequency tag sorting
    plugin.addCommand({
        id: 'toggle-tag-sort',
        name: strings.commands.toggleTagSort,
        callback: async () => {
            await plugin.activateView();
            plugin.settings.tagSortOrder = plugin.settings.tagSortOrder === 'frequency-desc' ? 'alpha-asc' : 'frequency-desc';
            await plugin.saveSettingsAndUpdate();
        }
    });

    // Command to toggle between single and dual pane layouts
    plugin.addCommand({
        id: 'toggle-dual-pane',
        name: strings.commands.toggleDualPane,
        callback: async () => {
            await plugin.activateView();
            plugin.toggleDualPanePreference();
        }
    });

    // Command to collapse or expand all folders in the navigation pane
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

    // Command to create a new note in the currently selected folder
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

    // Command to move selected files to a different folder
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

    // Command to select the next file in the current view
    plugin.addCommand({
        id: 'select-next-file',
        name: strings.commands.selectNextFile,
        callback: async () => {
            const leaf = await ensureNavigatorOpen(plugin);
            const view = leaf?.view;
            if (view instanceof NotebookNavigatorView) {
                await view.selectNextFileInCurrentView();
            }
        }
    });

    // Command to select the previous file in the current view
    plugin.addCommand({
        id: 'select-previous-file',
        name: strings.commands.selectPreviousFile,
        callback: async () => {
            const leaf = await ensureNavigatorOpen(plugin);
            const view = leaf?.view;
            if (view instanceof NotebookNavigatorView) {
                await view.selectPreviousFileInCurrentView();
            }
        }
    });

    // Command to convert the active file into a folder note
    plugin.addCommand({
        id: 'convert-to-folder-note',
        name: strings.commands.convertToFolderNote,
        checkCallback: (checking: boolean) => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                return false;
            }

            if (!plugin.settings.enableFolderNotes) {
                return false;
            }

            if (!isSupportedFolderNoteExtension(activeFile.extension)) {
                return false;
            }

            const parent = activeFile.parent;
            if (!parent || !(parent instanceof TFolder)) {
                return false;
            }

            if (
                isFolderNote(activeFile, parent, {
                    enableFolderNotes: plugin.settings.enableFolderNotes,
                    folderNoteName: plugin.settings.folderNoteName
                })
            ) {
                return false;
            }

            const fileSystemOps = plugin.fileSystemOps;
            if (!fileSystemOps) {
                return false;
            }

            if (checking) {
                return true;
            }

            void fileSystemOps.convertFileToFolderNote(activeFile, plugin.settings);
            return true;
        }
    });

    // Command to pin all folder notes to the shortcuts list
    plugin.addCommand({
        id: 'pin-all-folder-notes',
        name: strings.commands.pinAllFolderNotes,
        checkCallback: (checking: boolean) => {
            // Command only available when folder notes are enabled
            if (!plugin.settings.enableFolderNotes) {
                return false;
            }

            const metadataService = plugin.metadataService;
            if (!metadataService) {
                return false;
            }

            // Settings object for folder note detection
            const folderNoteSettings = {
                enableFolderNotes: plugin.settings.enableFolderNotes,
                folderNoteName: plugin.settings.folderNoteName
            };

            // List of folder notes that can be pinned
            const eligible: TFile[] = [];
            // Resolves frontmatter exclusions, returns empty array when hidden items are shown
            const { showHiddenItems } = plugin.getUXPreferences();
            const effectiveExcludedFiles = getEffectiveFrontmatterExclusions(plugin.settings, showHiddenItems);

            // Find all eligible folder notes in vault
            plugin.app.vault.getAllLoadedFiles().forEach(file => {
                // Skip non-file entries
                if (!(file instanceof TFile)) {
                    return;
                }

                // Skip files without parent folders
                const parent = file.parent;
                if (!parent || !(parent instanceof TFolder)) {
                    return;
                }

                // Skip files that are not folder notes
                if (!isFolderNote(file, parent, folderNoteSettings)) {
                    return;
                }

                // Skip folder notes in excluded folders when hidden items are disabled
                if (!plugin.getUXPreferences().showHiddenItems && isFolderInExcludedFolder(parent, plugin.settings.excludedFolders)) {
                    return;
                }

                // Skip files that are excluded by frontmatter when hidden items are disabled
                if (effectiveExcludedFiles.length > 0 && shouldExcludeFile(file, effectiveExcludedFiles, plugin.app)) {
                    return;
                }

                // Skip folder notes that are already pinned
                if (metadataService.isFilePinned(file.path, 'folder')) {
                    return;
                }

                eligible.push(file);
            });

            // Disable command if no folder notes can be pinned
            if (eligible.length === 0) {
                return false;
            }

            // Pin all eligible folder notes
            if (!checking) {
                void (async () => {
                    for (const note of eligible) {
                        await metadataService.togglePin(note.path, 'folder');
                    }

                    // Show notification with count of pinned folder notes
                    new Notice(strings.shortcuts.folderNotesPinned.replace('{count}', eligible.length.toString()));
                })();
            }

            return true;
        }
    });

    // Command to delete the currently active file
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

    // Command to clear and rebuild the entire local cache database
    plugin.addCommand({
        id: 'rebuild-cache',
        name: strings.commands.rebuildCache,
        callback: async () => {
            try {
                await plugin.rebuildCache(CacheRebuildMode.DropDatabaseSlow)
            } catch (error) {
                console.error('Failed to rebuild cache:', error);
            }
        }
    });

    // Command to add a tag to selected files
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

    // Command to remove a tag from selected files
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

    // Command to remove all tags from selected files
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

    // Command to show a modal for navigating to any folder
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

    // Command to show a modal for navigating to any tag
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

    // Command to add the current selection or active file to shortcuts
    plugin.addCommand({
        id: 'add-shortcut',
        name: strings.commands.addShortcut,
        callback: async () => {
            await ensureNavigatorOpen(plugin);

            const navigatorLeaves = plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of navigatorLeaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    await view.addShortcutForCurrentSelection();
                    break;
                }
            }
        }
    });

    // Command to open or focus the search input
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
