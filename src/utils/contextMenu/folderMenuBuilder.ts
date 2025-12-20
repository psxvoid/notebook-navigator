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

import { FileSystemAdapter, MenuItem, Platform, TFolder, TFile } from 'obsidian';
import { FolderMenuBuilderParams } from './menuTypes';
import { strings } from '../../i18n';
import { showNotice } from '../noticeUtils';
import { getInternalPlugin, isFolderAncestor, isPluginInstalled } from '../../utils/typeGuards';
import { getFolderNote, createFolderNote } from '../../utils/folderNotes';
import { cleanupExclusionPatterns, isFolderInExcludedFolder } from '../../utils/fileFilters';
import { ItemType } from '../../types';
import { resetHiddenToggleIfNoSources } from '../../utils/exclusionUtils';
import { runAsyncAction } from '../async';
import { setAsyncOnClick } from './menuAsyncHelpers';
import { getActiveVaultProfile, getHiddenFolderPatternMatch, normalizeHiddenFolderPath } from '../../utils/vaultProfiles';
import { EXCALIDRAW_PLUGIN_ID, TLDRAW_PLUGIN_ID } from '../../constants/pluginIds';
import { addStyleMenu } from './styleMenuBuilder';

/**
 * Adds folder creation commands (new note/folder/canvas/base/drawing) to a menu.
 */
export function buildFolderCreationMenu(params: FolderMenuBuilderParams): void {
    const { folder, menu, services, state, dispatchers } = params;
    const { app, fileSystemOps } = services;
    const { selectionState, expandedFolders } = state;
    const { selectionDispatch, expansionDispatch, uiDispatch } = dispatchers;
    const isVaultRoot = folder.path === '/';

    const ensureFolderSelected = () => {
        if (
            selectionState.selectionType === ItemType.FOLDER &&
            selectionState.selectedFolder &&
            selectionState.selectedFolder.path === folder.path
        ) {
            return;
        }

        selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });
    };

    // Selects newly created file and switches focus to files pane
    const handleFileCreation = (file: TFile | null | undefined) => {
        if (!file) {
            return;
        }

        // Select the newly created file in the list
        selectionDispatch({ type: 'SET_SELECTED_FILE', file });
        // Switch focus to the files pane to show the selection
        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
    };

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.folder.newNote).setIcon('lucide-pen-box'), async () => {
            ensureFolderSelected();
            const createdFile = await fileSystemOps.createNewFile(folder);
            handleFileCreation(createdFile);
        });
    });

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.folder.newFolder).setIcon('lucide-folder-plus'), async () => {
            ensureFolderSelected();
            await fileSystemOps.createNewFolder(folder, () => {
                if (!expandedFolders.has(folder.path)) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                }
            });
        });
    });

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.folder.newCanvas).setIcon('lucide-layout-grid'), async () => {
            ensureFolderSelected();
            const createdCanvas = await fileSystemOps.createCanvas(folder);
            handleFileCreation(createdCanvas);
        });
    });

    const basesPlugin = getInternalPlugin(app, 'bases');
    if (basesPlugin?.enabled) {
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.folder.newBase).setIcon('lucide-database'), async () => {
                ensureFolderSelected();
                const createdBase = await fileSystemOps.createBase(folder);
                handleFileCreation(createdBase);
            });
        });
    }

    // Collect available drawing plugins to determine menu structure
    const hasExcalidraw = isPluginInstalled(app, EXCALIDRAW_PLUGIN_ID);
    const hasTldraw = isPluginInstalled(app, TLDRAW_PLUGIN_ID);
    const hasBothDrawingPlugins = hasExcalidraw && hasTldraw;

    if (hasExcalidraw) {
        menu.addItem((item: MenuItem) => {
            const label = hasBothDrawingPlugins ? strings.contextMenu.folder.newExcalidrawDrawing : strings.contextMenu.folder.newDrawing;
            setAsyncOnClick(item.setTitle(label).setIcon('excalidraw-icon'), async () => {
                ensureFolderSelected();
                const createdDrawing = await fileSystemOps.createNewDrawing(folder, 'excalidraw');
                handleFileCreation(createdDrawing);
            });
        });
    }

    if (hasTldraw) {
        menu.addItem((item: MenuItem) => {
            const label = hasBothDrawingPlugins ? strings.contextMenu.folder.newTldrawDrawing : strings.contextMenu.folder.newDrawing;
            setAsyncOnClick(item.setTitle(label).setIcon('lucide-pencil'), async () => {
                ensureFolderSelected();
                const createdDrawing = await fileSystemOps.createNewDrawing(folder, 'tldraw');
                handleFileCreation(createdDrawing);
            });
        });
    }

    // Folder note operations
    const { settings } = params;
    const { metadataService } = services;
    if (settings.enableFolderNotes) {
        const folderNote = getFolderNote(folder, settings);
        const canDeleteFolderNote = Boolean(folderNote);
        const canCreateFolderNote = !folderNote && !isVaultRoot;

        if (canDeleteFolderNote || canCreateFolderNote) {
            menu.addSeparator();
        }

        if (folderNote) {
            // Detach folder note option
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.folder.detachFolderNote).setIcon('lucide-unlink'), async () => {
                    await fileSystemOps.renameFile(folderNote);
                });
            });

            // Delete folder note option
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.folder.deleteFolderNote).setIcon('lucide-trash'), async () => {
                    await fileSystemOps.deleteFile(folderNote, settings.confirmBeforeDelete);
                });
            });
        } else if (canCreateFolderNote) {
            // Create folder note option
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.folder.createFolderNote).setIcon('lucide-pen-box'), async () => {
                    const createdNote = await createFolderNote(
                        app,
                        folder,
                        {
                            folderNoteType: settings.folderNoteType,
                            folderNoteName: settings.folderNoteName,
                            folderNoteProperties: settings.folderNoteProperties
                        },
                        services.commandQueue
                    );
                    if (createdNote && settings.pinCreatedFolderNote) {
                        try {
                            if (!metadataService.isFilePinned(createdNote.path, 'folder')) {
                                await metadataService.togglePin(createdNote.path, 'folder');
                            }
                        } catch (error: unknown) {
                            console.error('Failed to pin created folder note', {
                                path: createdNote.path,
                                error
                            });
                        }
                    }
                });
            });
        }
    }
}

/**
 * Builds the context menu for a folder
 */
export function buildFolderMenu(params: FolderMenuBuilderParams): void {
    const { folder, menu, services, settings, state, dispatchers, options } = params;
    const { app, fileSystemOps, metadataService } = services;
    const { selectionState, expandedFolders } = state;
    const { selectionDispatch, expansionDispatch } = dispatchers;

    // Show folder name on mobile
    if (services.isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(folder.name).setIsLabel(true);
        });
    }

    buildFolderCreationMenu(params);

    menu.addSeparator();

    // Customization options: icon, color, background, separator
    // Only show icon options if folder icons are enabled
    if (settings.showFolderIcons) {
        // Change icon
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.folder.changeIcon).setIcon('lucide-image'), async () => {
                const { IconPickerModal } = await import('../../modals/IconPickerModal');
                const modal = new IconPickerModal(app, metadataService, folder.path, ItemType.FOLDER);
                modal.open();
            });
        });
    }

    // Change color
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.folder.changeColor).setIcon('lucide-palette'), async () => {
            const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
            const modal = new ColorPickerModal(app, metadataService, folder.path, ItemType.FOLDER, 'foreground');
            modal.open();
        });
    });

    // Change background color
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.folder.changeBackground).setIcon('lucide-paint-bucket'), async () => {
            const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
            const modal = new ColorPickerModal(app, metadataService, folder.path, ItemType.FOLDER, 'background');
            modal.open();
        });
    });

    const folderSeparatorTarget = { type: 'folder', path: folder.path } as const;
    const hasSeparator = metadataService.hasNavigationSeparator(folderSeparatorTarget);
    const disableNavigationSeparatorActions = Boolean(options?.disableNavigationSeparatorActions);

    const folderIcon = metadataService.getFolderIcon(folder.path);
    const folderColor = metadataService.getFolderColor(folder.path);
    const folderBackgroundColor = metadataService.getFolderBackgroundColor(folder.path);
    const directFolderColor = settings.folderColors?.[folder.path];
    const directFolderBackground = settings.folderBackgroundColors?.[folder.path];

    const hasRemovableIcon = Boolean(folderIcon);
    const hasRemovableColor = Boolean(directFolderColor);
    const hasRemovableBackground = Boolean(directFolderBackground);

    addStyleMenu({
        menu,
        styleData: {
            icon: folderIcon,
            color: folderColor,
            background: folderBackgroundColor
        },
        hasIcon: true,
        hasColor: true,
        hasBackground: true,
        applyStyle: async clipboard => {
            const { icon, color, background } = clipboard;
            const actions: Promise<void>[] = [];

            if (icon) {
                actions.push(metadataService.setFolderIcon(folder.path, icon));
            }
            if (color) {
                actions.push(metadataService.setFolderColor(folder.path, color));
            }
            if (background) {
                actions.push(metadataService.setFolderBackgroundColor(folder.path, background));
            }

            await Promise.all(actions);
        },
        removeIcon: hasRemovableIcon ? async () => metadataService.removeFolderIcon(folder.path) : undefined,
        removeColor: hasRemovableColor ? async () => metadataService.removeFolderColor(folder.path) : undefined,
        removeBackground: hasRemovableBackground ? async () => metadataService.removeFolderBackgroundColor(folder.path) : undefined
    });

    menu.addSeparator();

    // Add to shortcuts / Remove from shortcuts
    if (services.shortcuts) {
        const { folderShortcutKeysByPath, addFolderShortcut, removeShortcut } = services.shortcuts;
        const existingShortcutKey = folderShortcutKeysByPath.get(folder.path);

        menu.addItem((item: MenuItem) => {
            if (existingShortcutKey) {
                setAsyncOnClick(item.setTitle(strings.shortcuts.remove).setIcon('lucide-bookmark-x'), async () => {
                    await removeShortcut(existingShortcutKey);
                });
            } else {
                setAsyncOnClick(item.setTitle(strings.shortcuts.add).setIcon('lucide-bookmark'), async () => {
                    await addFolderShortcut(folder.path);
                });
            }
        });
    }

    if (!disableNavigationSeparatorActions) {
        menu.addItem((item: MenuItem) => {
            const title = hasSeparator ? strings.contextMenu.navigation.removeSeparator : strings.contextMenu.navigation.addSeparator;
            setAsyncOnClick(item.setTitle(title).setIcon('lucide-separator-horizontal'), async () => {
                if (hasSeparator) {
                    await metadataService.removeNavigationSeparator(folderSeparatorTarget);
                    return;
                }
                await metadataService.addNavigationSeparator(folderSeparatorTarget);
            });
        });
    }

    menu.addSeparator();

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

    menu.addSeparator();

    // Copy actions
    const adapter = app.vault.adapter;

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.folder.copyRelativePath).setIcon('lucide-clipboard-list'), async () => {
            await navigator.clipboard.writeText(folder.path);
            showNotice(strings.fileSystem.notifications.relativePathCopied, { variant: 'success' });
        });
    });

    if (adapter instanceof FileSystemAdapter) {
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.folder.copyPath).setIcon('lucide-clipboard'), async () => {
                const absolutePath = adapter.getFullPath(folder.path);
                await navigator.clipboard.writeText(absolutePath);
                showNotice(strings.fileSystem.notifications.pathCopied, { variant: 'success' });
            });
        });
    }

    menu.addSeparator();

    // Reveal in system explorer - desktop only
    if (!services.isMobile) {
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(
                item
                    .setTitle(fileSystemOps.getRevealInSystemExplorerText())
                    .setIcon(Platform.isMacOS ? 'lucide-app-window-mac' : 'lucide-app-window'),
                async () => {
                    await fileSystemOps.revealInSystemExplorer(folder);
                }
            );
        });

        menu.addSeparator();
    }

    // Hide/Unhide folder (not available for root folder)
    if (folder.path !== '/') {
        const { showHiddenItems } = services.visibility;
        // Get the active vault profile to access its hidden folder patterns
        const activeProfile = getActiveVaultProfile(services.plugin.settings);
        const excludedPatterns = activeProfile.hiddenFolders;
        const isExcluded = isFolderInExcludedFolder(folder, excludedPatterns);
        const normalizedFolderPath = normalizeHiddenFolderPath(folder.path);
        const matchingHiddenPattern = excludedPatterns.find(pattern => {
            const match = getHiddenFolderPatternMatch(pattern);
            return Boolean(match && match.normalizedPrefix === normalizedFolderPath);
        });

        if (matchingHiddenPattern) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.folder.unhideFolder).setIcon('lucide-eye'), async () => {
                    const currentExcluded = activeProfile.hiddenFolders;
                    activeProfile.hiddenFolders = currentExcluded.filter(pattern => pattern !== matchingHiddenPattern);
                    resetHiddenToggleIfNoSources({
                        settings: services.plugin.settings,
                        showHiddenItems,
                        setShowHiddenItems: value => services.plugin.setShowHiddenItems(value)
                    });
                    await services.plugin.saveSettingsAndUpdate();

                    showNotice(strings.fileSystem.notices.showFolder.replace('{name}', folder.name), { variant: 'success' });
                });
            });
        } else if (!isExcluded) {
            menu.addItem((item: MenuItem) => {
                setAsyncOnClick(item.setTitle(strings.contextMenu.folder.excludeFolder).setIcon('lucide-eye-off'), async () => {
                    const currentExcluded = activeProfile.hiddenFolders;
                    // Ensure path starts with / for path-based exclusion
                    // Obsidian folder paths don't start with /, so we add it
                    const folderPath = folder.path.startsWith('/') ? folder.path : `/${folder.path}`;

                    // Clean up redundant patterns and add the new one
                    const cleanedPatterns = cleanupExclusionPatterns(currentExcluded, folderPath);

                    activeProfile.hiddenFolders = cleanedPatterns;
                    resetHiddenToggleIfNoSources({
                        settings: services.plugin.settings,
                        showHiddenItems,
                        setShowHiddenItems: value => services.plugin.setShowHiddenItems(value)
                    });
                    await services.plugin.saveSettingsAndUpdate();

                    showNotice(strings.fileSystem.notices.hideFolder.replace('{name}', folder.name), { variant: 'success' });
                });
            });
        }
    }

    // Rename folder
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.folder.renameFolder).setIcon('lucide-pencil'), async () => {
            // Handle root folder rename differently
            if (folder.path === '/') {
                const { InputModal } = await import('../../modals/InputModal');
                const modal = new InputModal(
                    app,
                    strings.modals.fileSystem.renameVaultTitle,
                    strings.modals.fileSystem.renameVaultPrompt,
                    newName => {
                        runAsyncAction(async () => {
                            // Update custom vault name setting (allow empty string)
                            services.plugin.settings.customVaultName = newName;
                            await services.plugin.saveSettingsAndUpdate();
                        });
                    },
                    settings.customVaultName
                );
                modal.open();
            } else {
                await fileSystemOps.renameFolder(folder, settings);
            }
        });
    });

    // Move folder (not available for vault root)
    if (folder.path !== '/') {
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.folder.moveFolder).setIcon('lucide-folder-input'), async () => {
                // Open modal to select destination folder for move operation
                const moveResult = await fileSystemOps.moveFolderWithModal(folder);
                if (moveResult.status !== 'success') {
                    return;
                }

                const { oldPath, newPath, targetFolder } = moveResult.data;
                // Verify the moved folder exists at new location
                const movedEntry = app.vault.getAbstractFileByPath(newPath);
                if (!movedEntry || !(movedEntry instanceof TFolder)) {
                    return;
                }

                // Update selection if the moved folder was selected
                const selectedFolder = selectionState.selectedFolder;
                if (selectedFolder === folder) {
                    selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder: movedEntry });
                }

                // Update expansion state for all moved folders and their descendants
                const updatedExpanded = new Set<string>();
                const oldPrefix = `${oldPath}/`;

                expandedFolders.forEach(path => {
                    // Update path for the moved folder itself
                    if (path === oldPath) {
                        updatedExpanded.add(newPath);
                        return;
                    }

                    // Update paths for descendants of the moved folder
                    if (path.startsWith(oldPrefix)) {
                        const suffix = path.substring(oldPrefix.length);
                        const updatedPath = suffix.length > 0 ? `${newPath}/${suffix}` : newPath;
                        updatedExpanded.add(updatedPath);
                        return;
                    }

                    // Keep paths for folders not affected by the move
                    updatedExpanded.add(path);
                });

                // Expand the destination folder to show the moved folder
                const parentPath = targetFolder.path;
                if (parentPath !== '/' && !updatedExpanded.has(parentPath)) {
                    updatedExpanded.add(parentPath);
                }

                expansionDispatch({ type: 'SET_EXPANDED_FOLDERS', folders: updatedExpanded });
            });
        });
    }

    // Duplicate folder
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.folder.duplicateFolder).setIcon('lucide-copy'), async () => {
            await fileSystemOps.duplicateFolder(folder);
        });
    });

    // Delete folder (not available for vault root)
    if (folder.path !== '/') {
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.folder.deleteFolder).setIcon('lucide-trash'), async () => {
                const parentFolder = folder.parent;

                await fileSystemOps.deleteFolder(folder, settings.confirmBeforeDelete, () => {
                    // Check if we need to update selection
                    if (selectionState.selectedFolder) {
                        const isSelectedFolderDeleted = folder.path === selectionState.selectedFolder.path;
                        const isAncestorDeleted = isFolderAncestor(folder, selectionState.selectedFolder);

                        if (isSelectedFolderDeleted || isAncestorDeleted) {
                            // If parent exists and is not root (or root is visible), select it
                            if (parentFolder && (parentFolder.path !== '/' || settings.showRootFolder)) {
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
