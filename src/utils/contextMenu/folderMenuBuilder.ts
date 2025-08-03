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

import { MenuItem, Notice, normalizePath } from 'obsidian';
import { FolderMenuBuilderParams } from './menuTypes';
import { strings } from '../../i18n';
import { getInternalPlugin, isFolderAncestor } from '../../utils/typeGuards';
import { getFolderNote } from '../../utils/fileFinder';
import { ExtendedApp } from '../../types/obsidian-extended';

/**
 * Builds the context menu for a folder
 */
export function buildFolderMenu(params: FolderMenuBuilderParams): void {
    const { folder, menu, services, settings, state, dispatchers } = params;
    const { app, fileSystemOps, metadataService, commandQueue } = services;
    const { selectionState, expandedFolders } = state;
    const { selectionDispatch, expansionDispatch } = dispatchers;

    // New note
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.newNote)
            .setIcon('pen-box')
            .onClick(async () => {
                await fileSystemOps.createNewFile(folder);
            });
    });

    // New folder
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.newFolder)
            .setIcon('folder-plus')
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
            .setIcon('layout-grid')
            .onClick(async () => {
                await fileSystemOps.createCanvas(folder);
            });
    });

    // New base (only if Bases plugin is enabled)
    const basesPlugin = getInternalPlugin(app, 'bases');
    if (basesPlugin?.enabled) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.folder.newBase)
                .setIcon('database')
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
                .setIcon('pencil')
                .onClick(async () => {
                    await fileSystemOps.createNewDrawing(folder);
                });
        });
    }

    menu.addSeparator();

    // Duplicate folder
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.duplicateFolder)
            .setIcon('documents')
            .onClick(async () => {
                await fileSystemOps.duplicateFolder(folder);
            });
    });

    // Search in folder
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.searchInFolder)
            .setIcon('search')
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
                .setIcon('folder-open')
                .onClick(async () => {
                    await fileSystemOps.revealInSystemExplorer(folder);
                });
        });
    }

    // Folder note operations
    if (settings.enableFolderNotes) {
        menu.addSeparator();

        const folderNote = getFolderNote(folder, settings, app);

        if (folderNote) {
            // Delete folder note option
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.folder.deleteFolderNote)
                    .setIcon('trash')
                    .onClick(async () => {
                        await fileSystemOps.deleteFile(folderNote, settings.confirmBeforeDelete);
                    });
            });
        } else {
            // Create folder note option
            menu.addItem((item: MenuItem) => {
                item.setTitle(strings.contextMenu.folder.createFolderNote)
                    .setIcon('pen-box')
                    .onClick(async () => {
                        // Use folderNoteName if set, otherwise use folder name
                        const noteName = (settings.folderNoteName || folder.name) + '.md';
                        const notePath = normalizePath(`${folder.path}/${noteName}`);

                        // Check if file already exists
                        const existingFile = app.vault.getAbstractFileByPath(notePath);
                        if (existingFile) {
                            new Notice(strings.fileSystem.errors.folderNoteAlreadyExists);
                            return;
                        }

                        // Create content with frontmatter if folderNoteProperty is set
                        let content = '';
                        if (settings.folderNoteProperty) {
                            content = `---\n${settings.folderNoteProperty}: true\n---\n`;
                        }

                        const file = await app.vault.create(notePath, content);

                        await commandQueue!.executeOpenFolderNote(folder.path, async () => {
                            await app.workspace.getLeaf().openFile(file);
                        });
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
                .setIcon('palette')
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
                    .setIcon('x')
                    .onClick(async () => {
                        await metadataService.removeFolderIcon(folder.path);
                    });
            });
        }
    }

    menu.addSeparator();

    // Change color
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.changeColor)
            .setIcon('palette')
            .onClick(async () => {
                const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
                const modal = new ColorPickerModal(app, metadataService, folder.path);
                modal.open();
            });
    });

    // Remove color (only show if custom color is set)
    const currentColor = metadataService.getFolderColor(folder.path);
    if (currentColor) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.folder.removeColor)
                .setIcon('x')
                .onClick(async () => {
                    await metadataService.removeFolderColor(folder.path);
                });
        });
    }

    menu.addSeparator();

    // Rename folder
    menu.addItem((item: MenuItem) => {
        item.setTitle(strings.contextMenu.folder.renameFolder)
            .setIcon('pencil')
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
                            await services.plugin.saveSettings();
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
                .setIcon('trash')
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
