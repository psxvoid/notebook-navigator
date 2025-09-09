/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import { MenuItem, Notice, normalizePath, Platform } from 'obsidian';
import { FolderMenuBuilderParams } from './menuTypes';
import { strings } from '../../i18n';
import { getInternalPlugin, isFolderAncestor } from '../../utils/typeGuards';
import { getFolderNote } from '../../utils/fileFinder';
import { ExtendedApp } from '../../types/obsidian-extended';
import { cleanupExclusionPatterns, isFolderInExcludedFolder } from '../../utils/fileFilters';

/**
 * Builds the context menu for a folder
 */
export function buildFolderMenu(params: FolderMenuBuilderParams): void {
    const { folder, menu, services, settings, state, dispatchers } = params;
    const { app, fileSystemOps, metadataService, commandQueue } = services;
    const { selectionState, expandedFolders } = state;
    const { selectionDispatch, expansionDispatch } = dispatchers;

    // Show folder name on mobile
    if (services.isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(folder.name).setIsLabel(true);
        });
    }

    // New note
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.newNote)
            .setIcon('lucide-pen-box')
            .onClick(async () => {
                await fileSystemOps.createNewFile(folder);
            });
    });

    // New folder
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.newFolder)
            .setIcon('lucide-folder-plus')
            .onClick(async () => {
                await fileSystemOps.createNewFolder(folder, () => {
                    // Expand the parent folder to show the newly created folder
                    if (!expandedFolders.has(folder.path)) {
                        expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                    }
                });
            });
    });

    // New canvas
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.newCanvas)
            .setIcon('lucide-layout-grid')
            .onClick(async () => {
                await fileSystemOps.createCanvas(folder);
            });
    });

    // New base (only if Bases plugin is enabled)
    const basesPlugin = getInternalPlugin(app, 'bases');
    if (basesPlugin?.enabled) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.folder.newBase)
                .setIcon('lucide-database')
                .onClick(async () => {
                    await fileSystemOps.createBase(folder);
                });
        });
    }

    // New drawing (only if Excalidraw plugin is installed)
    const isExcalidrawInstalled = !!(app as ExtendedApp).plugins?.plugins?.['obsidian-excalidraw-plugin'];
    if (isExcalidrawInstalled) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.folder.newDrawing)
                .setIcon('lucide-pencil')
                .onClick(async () => {
                    await fileSystemOps.createNewDrawing(folder);
                });
        });
    }

    menu.addSeparator();

    // Duplicate folder
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.duplicateFolder)
            .setIcon('lucide-copy')
            .onClick(async () => {
                await fileSystemOps.duplicateFolder(folder);
            });
    });

    // Search in folder
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.searchInFolder)
            .setIcon('lucide-search')
            .onClick(() => {
                interface SearchPlugin {
                    enabled: boolean;
                    instance?: {
                        openGlobalSearch(query: string): void;
                    };
                }
                const searchPlugin = getInternalPlugin<SearchPlugin>(app, 'global-search');
                if (searchPlugin?.instance) {
                    searchPlugin.instance.openGlobalSearch(`path:"${folder.path}"`);
                }
            });
    });

    // Reveal in system explorer - desktop only
    if (!services.isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(fileSystemOps.getRevealInSystemExplorerText())
                .setIcon(Platform.isMacOS ? 'lucide-app-window-mac' : 'lucide-app-window')
                .onClick(async () => {
                    await fileSystemOps.revealInSystemExplorer(folder);
                });
        });
    }

    // Folder note operations
    if (settings.enableFolderNotes) {
        menu.addSeparator();

        const folderNote = getFolderNote(folder, settings);

        if (folderNote) {
            // Delete folder note option
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.folder.deleteFolderNote)
                    .setIcon('lucide-trash')
                    .onClick(async () => {
                        await fileSystemOps.deleteFile(folderNote, settings.confirmBeforeDelete);
                    });
            });
        } else {
            // Create folder note option
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.folder.createFolderNote)
                    .setIcon('lucide-pen-box')
                    .onClick(async () => {
                        // Use folderNoteName if set, otherwise use folder name
                        const noteName = `${settings.folderNoteName || folder.name}.md`;
                        const notePath = normalizePath(`${folder.path}/${noteName}`);

                        // Check if file already exists
                        const existingFile = app.vault.getAbstractFileByPath(notePath);
                        if (existingFile) {
                            new Notice(strings.fileSystem.errors.folderNoteAlreadyExists);
                            return;
                        }

                        // Create content with frontmatter if folderNoteProperties are set
                        let content = '';
                        if (settings.folderNoteProperties.length > 0) {
                            const properties = settings.folderNoteProperties.map(prop => `${prop}: true`).join('\n');
                            content = `---\n${properties}\n---\n`;
                        }

                        const file = await app.vault.create(notePath, content);

                        if (commandQueue) {
                            await commandQueue.executeOpenFolderNote(folder.path, async () => {
                                await app.workspace.getLeaf().openFile(file);
                            });
                        } else {
                            // Fallback: just open the file without command queue
                            await app.workspace.getLeaf().openFile(file);
                        }
                    });
            });
        }
    }

    // Only show icon options if folder icons are enabled
    if (settings.showIcons) {
        menu.addSeparator();

        // Change icon
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.folder.changeIcon)
                .setIcon('lucide-image')
                .onClick(async () => {
                    const { IconPickerModal } = await import('../../modals/IconPickerModal');
                    const modal = new IconPickerModal(app, metadataService, folder.path);
                    modal.open();
                });
        });

        // Remove icon (only show if custom icon is set)
        const currentIcon = metadataService.getFolderIcon(folder.path);
        if (currentIcon) {
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.folder.removeIcon)
                    .setIcon('lucide-x')
                    .onClick(async () => {
                        await metadataService.removeFolderIcon(folder.path);
                    });
            });
        }
    }

    // Change color
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.changeColor)
            .setIcon('lucide-palette')
            .onClick(async () => {
                const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
                const modal = new ColorPickerModal(app, metadataService, folder.path);
                modal.open();
            });
    });

    // Remove color (only show if custom color is set directly on this folder)
    const hasDirectColor = settings.folderColors && settings.folderColors[folder.path];
    if (hasDirectColor) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.folder.removeColor)
                .setIcon('lucide-x')
                .onClick(async () => {
                    await metadataService.removeFolderColor(folder.path);
                });
        });
    }

    menu.addSeparator();

    // Hide folder (not available for root folder or already hidden folders)
    if (folder.path !== '/') {
        // Check if folder is already excluded using proper wildcard pattern matching
        const excludedPatterns = services.plugin.settings.excludedFolders;
        const isExcluded = isFolderInExcludedFolder(folder, excludedPatterns);

        // Only show "Hide folder" if not already excluded
        if (!isExcluded) {
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.folder.excludeFolder)
                    .setIcon('lucide-eye-off')
                    .onClick(async () => {
                        const currentExcluded = services.plugin.settings.excludedFolders;
                        // Ensure path starts with / for path-based exclusion
                        // Obsidian folder paths don't start with /, so we add it
                        const folderPath = folder.path.startsWith('/') ? folder.path : `/${folder.path}`;

                        // Clean up redundant patterns and add the new one
                        const cleanedPatterns = cleanupExclusionPatterns(currentExcluded, folderPath);

                        services.plugin.settings.excludedFolders = cleanedPatterns;
                        await services.plugin.saveSettingsAndUpdate();

                        new Notice(strings.fileSystem.notices.excludedFolder.replace('{name}', folder.name));
                    });
            });
        }
    }

    // Rename folder
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.renameFolder)
            .setIcon('lucide-pencil')
            .onClick(async () => {
                // Handle root folder rename differently
                if (folder.path === '/') {
                    const { InputModal } = await import('../../modals/InputModal');
                    const modal = new InputModal(
                        app,
                        strings.modals.fileSystem.renameVaultTitle,
                        strings.modals.fileSystem.renameVaultPrompt,
                        async newName => {
                            // Update custom vault name setting (allow empty string)
                            services.plugin.settings.customVaultName = newName;
                            await services.plugin.saveSettingsAndUpdate();
                        },
                        settings.customVaultName
                    );
                    modal.open();
                } else {
                    await fileSystemOps.renameFolder(folder, settings);
                }
            });
    });

    // Delete folder (not available for vault root)
    if (folder.path !== '/') {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.folder.deleteFolder)
                .setIcon('lucide-trash')
                .onClick(async () => {
                    const parentFolder = folder.parent;

                    await fileSystemOps.deleteFolder(folder, settings.confirmBeforeDelete, () => {
                        // Check if we need to update selection
                        if (selectionState.selectedFolder) {
                            const isSelectedFolderDeleted = folder.path === selectionState.selectedFolder.path;
                            const isAncestorDeleted = isFolderAncestor(folder, selectionState.selectedFolder);

                            if (isSelectedFolderDeleted || isAncestorDeleted) {
                                // If parent exists and is not root (or root is visible), select it
                                if (parentFolder && (parentFolder.path !== '' || settings.showRootFolder)) {
                                    selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder: parentFolder });
                                } else {
                                    // Clear selection if no valid parent
                                    selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder: null });
                                }
                            }
                        }
                    });
                });
        });
    }
}
