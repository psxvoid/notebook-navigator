/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad, modifications by Pavel Sapehin
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/*
 * Notebook Navigator Ex - Plugin for Obsidian
 */

import { TFile, TFolder, type WorkspaceLeaf } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { strings } from '../../i18n';
import { isFolderNote, isSupportedFolderNoteExtension } from '../../utils/folderNotes';
import { isFolderInExcludedFolder, shouldExcludeFile } from '../../utils/fileFilters';
import { getEffectiveFrontmatterExclusions, isFileHiddenBySettings } from '../../utils/exclusionUtils';
import { runAsyncAction } from '../../utils/async';
import { NotebookNavigatorView } from '../../view/NotebookNavigatorView';
import { getActiveHiddenFolders } from '../../utils/vaultProfiles';
import { showNotice } from '../../utils/noticeUtils';
import { SelectVaultProfileModal } from '../../modals/SelectVaultProfileModal';

import { CacheRebuildMode } from '../../main';

/**
 * Reveals the navigator view and focuses whichever pane is currently visible
 * @param plugin - The plugin instance
 */
async function focusNavigatorVisiblePane(plugin: NotebookNavigatorPlugin, existingLeaves?: WorkspaceLeaf[]): Promise<void> {
    const navigatorLeaves = existingLeaves ?? plugin.getNavigatorLeaves();
    if (navigatorLeaves.length > 0) {
        const leaf = navigatorLeaves[0];
        await plugin.app.workspace.revealLeaf(leaf);
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
async function ensureNavigatorOpen(
    plugin: NotebookNavigatorPlugin,
    existingLeaves?: WorkspaceLeaf[]
): Promise<NotebookNavigatorView | null> {
    const navigatorLeaves = existingLeaves ?? plugin.getNavigatorLeaves();
    if (navigatorLeaves.length > 0) {
        const leaf = navigatorLeaves[0];
        await plugin.app.workspace.revealLeaf(leaf);
        const view = leaf.view;
        return view instanceof NotebookNavigatorView ? view : null;
    }

    const createdLeaf = await plugin.activateView();
    if (!createdLeaf) {
        return null;
    }
    const view = createdLeaf.view;
    return view instanceof NotebookNavigatorView ? view : null;
}

/**
 * Returns the profile ID at the specified zero-based index, or null if it doesn't exist
 */
function getVaultProfileIdAtIndex(plugin: NotebookNavigatorPlugin, index: number): string | null {
    const profiles = Array.isArray(plugin.settings.vaultProfiles) ? plugin.settings.vaultProfiles : [];
    if (index < 0 || index >= profiles.length) {
        return null;
    }
    const profile = profiles[index];
    return profile?.id ?? null;
}

/**
 * Opens the modal that lists all vault profiles for manual selection
 */
function openVaultProfilePicker(plugin: NotebookNavigatorPlugin): void {
    const modal = new SelectVaultProfileModal(plugin.app, {
        profiles: plugin.settings.vaultProfiles ?? [],
        activeProfileId: plugin.settings.vaultProfile,
        onSelect: profileId => plugin.setVaultProfile(profileId)
    });
    modal.open();
}

/**
 * Registers all navigator commands with the plugin
 */
export default function registerNavigatorCommands(plugin: NotebookNavigatorPlugin): void {
    // Command to open the navigator or focus it if already open
    plugin.addCommand({
        id: 'open',
        name: strings.commands.open,
        callback: () => {
            // Wrap async operations with error handling
            runAsyncAction(async () => {
                const navigatorLeaves = plugin.getNavigatorLeaves();
                if (navigatorLeaves.length > 0) {
                    await focusNavigatorVisiblePane(plugin, navigatorLeaves);
                    return;
                }
                await plugin.activateView();
            });
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
                // Execute homepage opening with error handling
                runAsyncAction(() => plugin.openHomepage('command'));
            }

            return true;
        }
    });

    plugin.addCommand({
        id: 'pane-jump-top',
        name: strings.commands.paneJumpTop,
        checkCallback: (checking: boolean) => {
            if (!checking) {
                void plugin.cmdJumpTop()
            }

            return true;
        }
    });

    plugin.addCommand({
        id: 'pane-jump-bottom',
        name: strings.commands.paneJumpBottom,
        checkCallback: (checking: boolean) => {
            if (!checking) {
                void plugin.cmdJumpBottom()
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
                    // Wrap file reveal with error handling
                    runAsyncAction(async () => {
                        await plugin.activateView();
                        if (isFileHiddenBySettings(activeFile, plugin.settings, plugin.app, plugin.getUXPreferences().showHiddenItems)) {
                            showNotice(strings.fileSystem.notifications.hiddenFileReveal, { variant: 'warning' });
                        }
                        await plugin.revealFileInActualFolder(activeFile);
                    });
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
        callback: () => {
            // Wrap toggle with error handling
            runAsyncAction(async () => {
                await plugin.activateView();
                plugin.toggleIncludeDescendantNotes();
            });
        }
    });

    // Command to toggle showing hidden files and folders
    plugin.addCommand({
        id: 'toggle-hidden',
        name: strings.commands.toggleHidden,
        callback: () => {
            // Wrap toggle with error handling
            runAsyncAction(async () => {
                await plugin.activateView();
                plugin.toggleShowHiddenItems();
            });
        }
    });

    // Command to toggle between alphabetical and frequency tag sorting
    plugin.addCommand({
        id: 'toggle-tag-sort',
        name: strings.commands.toggleTagSort,
        callback: () => {
            // Wrap sort toggle with error handling
            runAsyncAction(async () => {
                await plugin.activateView();
                plugin.settings.tagSortOrder = plugin.settings.tagSortOrder === 'frequency-desc' ? 'alpha-asc' : 'frequency-desc';
                await plugin.saveSettingsAndUpdate();
            });
        }
    });

    // Command to toggle between single and dual pane layouts
    plugin.addCommand({
        id: 'toggle-dual-pane',
        name: strings.commands.toggleDualPane,
        callback: () => {
            // Wrap pane toggle with error handling
            runAsyncAction(async () => {
                await plugin.activateView();
                plugin.toggleDualPanePreference();
            });
        }
    });

    // Command to select the active vault profile via modal picker
    plugin.addCommand({
        id: 'select-profile',
        name: strings.commands.selectVaultProfile,
        callback: () => {
            openVaultProfilePicker(plugin);
        }
    });

    const registerQuickProfileCommand = (commandId: string, commandName: string, profileIndex: number): void => {
        plugin.addCommand({
            id: commandId,
            name: commandName,
            callback: () => {
                const profileId = getVaultProfileIdAtIndex(plugin, profileIndex);
                if (!profileId) {
                    openVaultProfilePicker(plugin);
                    return;
                }
                runAsyncAction(() => plugin.setVaultProfile(profileId));
            }
        });
    };

    registerQuickProfileCommand('select-profile-1', strings.commands.selectVaultProfile1, 0);
    registerQuickProfileCommand('select-profile-2', strings.commands.selectVaultProfile2, 1);
    registerQuickProfileCommand('select-profile-3', strings.commands.selectVaultProfile3, 2);

    // Command to collapse or expand all folders in the navigation pane
    plugin.addCommand({
        id: 'collapse-expand',
        name: strings.commands.collapseExpand,
        callback: () => {
            // Wrap collapse/expand with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    view.triggerCollapse();
                }
            });
        }
    });

    // Command to create a new note in the currently selected folder
    plugin.addCommand({
        id: 'new-note',
        name: strings.commands.createNewNote,
        callback: () => {
            // Wrap note creation with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.createNoteInSelectedFolder();
                }
            });
        }
    });

    // Command to move selected files to a different folder
    plugin.addCommand({
        id: 'move-files',
        name: strings.commands.moveFiles,
        callback: () => {
            // Wrap move operation with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.moveSelectedFiles();
                }
            });
        }
    });

    // Command to select the next file in the current view
    plugin.addCommand({
        id: 'select-next-file',
        name: strings.commands.selectNextFile,
        callback: () => {
            // Wrap file selection with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.selectNextFileInCurrentView();
                }
            });
        }
    });

    // Command to select the previous file in the current view
    plugin.addCommand({
        id: 'select-previous-file',
        name: strings.commands.selectPreviousFile,
        callback: () => {
            // Wrap file selection with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.selectPreviousFileInCurrentView();
                }
            });
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

            // Convert file to folder note with error handling
            runAsyncAction(() => fileSystemOps.convertFileToFolderNote(activeFile, plugin.settings));
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
            // Gets the list of folders hidden by the active vault profile
            const hiddenFolders = getActiveHiddenFolders(plugin.settings);

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
                if (!plugin.getUXPreferences().showHiddenItems && isFolderInExcludedFolder(parent, hiddenFolders)) {
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
                // Pin all folder notes with error handling
                runAsyncAction(async () => {
                    for (const note of eligible) {
                        await metadataService.togglePin(note.path, 'folder');
                    }

                    // Show notification with count of pinned folder notes
                    showNotice(strings.shortcuts.folderNotesPinned.replace('{count}', eligible.length.toString()), { variant: 'success' });
                });
            }

            return true;
        }
    });

    // Command to delete the currently active file
    plugin.addCommand({
        id: 'delete-files',
        name: strings.commands.deleteFile,
        callback: () => {
            // Wrap delete operation with error handling
            runAsyncAction(async () => {
                await plugin.activateView();

                const navigatorLeaves = plugin.getNavigatorLeaves();
                navigatorLeaves.forEach(leaf => {
                    const view = leaf.view;
                    if (view instanceof NotebookNavigatorView) {
                        view.deleteActiveFile();
                    }
                });
            });
        }
    });

    // Command to clear and rebuild the entire local cache database
    plugin.addCommand({
        id: 'rebuild-cache',
        name: strings.commands.rebuildCache,
        callback: () => {
            // Wrap cache rebuild with error handling and logging
            runAsyncAction(async () => {
                try {
                    await plugin.rebuildCache(CacheRebuildMode.DropDatabaseSlow)
                } catch (error) {
                    console.error('Failed to rebuild cache:', error);
                }
            });
        }
    });

    // Command to add a tag to selected files
    plugin.addCommand({
        id: 'add-tag',
        name: strings.commands.addTag,
        callback: () => {
            // Wrap tag addition with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.addTagToSelectedFiles();
                }
            });
        }
    });

    // Command to remove a tag from selected files
    plugin.addCommand({
        id: 'remove-tag',
        name: strings.commands.removeTag,
        callback: () => {
            // Wrap tag removal with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.removeTagFromSelectedFiles();
                }
            });
        }
    });

    // Command to remove all tags from selected files
    plugin.addCommand({
        id: 'remove-all-tags',
        name: strings.commands.removeAllTags,
        callback: () => {
            // Wrap tag removal with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.removeAllTagsFromSelectedFiles();
                }
            });
        }
    });

    // Command to show a modal for navigating to any folder
    plugin.addCommand({
        id: 'navigate-to-folder',
        name: strings.commands.navigateToFolder,
        callback: () => {
            // Wrap folder navigation with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.navigateToFolderWithModal();
                }
            });
        }
    });

    // Command to show a modal for navigating to any tag
    plugin.addCommand({
        id: 'navigate-to-tag',
        name: strings.commands.navigateToTag,
        callback: () => {
            // Wrap tag navigation with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.navigateToTagWithModal();
                }
            });
        }
    });

    // Command to add the current selection or active file to shortcuts
    plugin.addCommand({
        id: 'add-shortcut',
        name: strings.commands.addShortcut,
        callback: () => {
            // Wrap shortcut creation with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    await view.addShortcutForCurrentSelection();
                }
            });
        }
    });

    // Command to open or focus the search input
    plugin.addCommand({
        id: 'search',
        name: strings.commands.search,
        callback: () => {
            // Wrap search toggle with error handling
            runAsyncAction(async () => {
                const view = await ensureNavigatorOpen(plugin);
                if (view) {
                    view.toggleSearch();
                }
            });
        }
    });
}
