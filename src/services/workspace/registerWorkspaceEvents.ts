/*
 * Notebook Navigator - Plugin for Obsidian
 */

import { TFile, TFolder } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { strings } from '../../i18n';
import { runAsyncAction } from '../../utils/async';

/**
 * Registers all workspace-related event listeners for the plugin
 */
export default function registerWorkspaceEvents(plugin: NotebookNavigatorPlugin): void {
    // Add "Reveal in Navigator" to editor context menu
    plugin.registerEvent(
        plugin.app.workspace.on('editor-menu', (menu, _, view) => {
            const file = view.file;
            if (!file) {
                return;
            }

            menu.addSeparator();
            menu.addItem(item => {
                item.setTitle(strings.plugin.revealInNavigator)
                    .setIcon('lucide-folder-open')
                    .onClick(() => {
                        // Wrap file reveal with error handling
                        runAsyncAction(async () => {
                            await plugin.activateView();
                            await plugin.revealFileInActualFolder(file);
                        });
                    });
            });
        })
    );

    // Add Notebook Navigator option to the folder explorer menu
    plugin.registerEvent(
        plugin.app.workspace.on('file-menu', (menu, file) => {
            // Add navigate option for folders
            if (file instanceof TFolder) {
                menu.addItem(item => {
                    item.setTitle(strings.plugin.revealInNavigator)
                        .setIcon('lucide-notebook')
                        .onClick(() => {
                            // Wrap folder navigation with error handling
                            runAsyncAction(async () => {
                                await plugin.navigateToFolder(file, { preserveNavigationFocus: true });
                            });
                        });
                });
            }
        })
    );

    // Add ribbon icon to open the navigator
    plugin.ribbonIconEl = plugin.addRibbonIcon('lucide-notebook', strings.plugin.ribbonTooltip, () => {
        // Activate navigator view with error handling
        runAsyncAction(() => plugin.activateView());
    });

    // Track file opens for recent notes history
    plugin.registerEvent(
        plugin.app.workspace.on('file-open', file => {
            if (!(file instanceof TFile) || plugin.isFileInRightSidebar(file)) {
                return;
            }

            plugin.recentNotesService?.recordFileOpen(file);
        })
    );

    // Record the initially active file if it exists
    const initialActiveFile = plugin.app.workspace.getActiveFile();
    if (initialActiveFile instanceof TFile && !plugin.isFileInRightSidebar(initialActiveFile)) {
        plugin.recentNotesService?.recordFileOpen(initialActiveFile);
    }

    // Handle file and folder renames
    plugin.registerEvent(
        plugin.app.vault.on('rename', (file, oldPath) => {
            runAsyncAction(async () => {
                if (plugin.isShuttingDown()) {
                    return;
                }

                if (file instanceof TFolder) {
                    // Update folder metadata (colors, icons, etc.) to use new path
                    await plugin.metadataService?.handleFolderRename(oldPath, file.path);
                    return;
                }

                if (!(file instanceof TFile)) {
                    return;
                }

                // Update recent notes history with new path
                plugin.recentNotesService?.renameEntry(oldPath, file.path);
                await plugin.metadataService?.handleFileRename(oldPath, file.path);

                // Helper to extract parent folder path from file path
                const getParentPath = (path: string): string => {
                    const lastSlash = path.lastIndexOf('/');
                    return lastSlash > 0 ? path.substring(0, lastSlash) : '/';
                };

                // Auto-reveal active file if it was moved to a different folder
                const movedToDifferentFolder = getParentPath(oldPath) !== getParentPath(file.path);
                if (movedToDifferentFolder && file === plugin.app.workspace.getActiveFile()) {
                    // Skip reveal if the move was initiated from within the Navigator
                    if (!plugin.commandQueue?.isMovingFile()) {
                        await plugin.revealFileInActualFolder(file);
                    }
                }

                // Notify selection context to update stored file paths
                plugin.notifyFileRenameListeners(oldPath, file.path);
            });
        })
    );

    // Handle file and folder deletions
    plugin.registerEvent(
        plugin.app.vault.on('delete', file => {
            runAsyncAction(async () => {
                if (plugin.isShuttingDown()) {
                    return;
                }

                if (file instanceof TFolder) {
                    // Clean up folder metadata (colors, icons, etc.)
                    await plugin.metadataService?.handleFolderDelete(file.path);
                    return;
                }

                if (!(file instanceof TFile)) {
                    return;
                }

                // Remove from recent notes history
                plugin.recentNotesService?.removeEntry(file.path);
                if (plugin.metadataService) {
                    await plugin.metadataService.handleFileDelete(file.path);
                }
            });
        })
    );
}
