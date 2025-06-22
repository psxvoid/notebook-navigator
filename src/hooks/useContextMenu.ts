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

// src/hooks/useContextMenu.ts
import { useEffect, useCallback } from 'react';
import { Menu, MenuItem, TFile, TFolder, Notice, normalizePath } from 'obsidian';
import { useServices, useFileSystemOps, useMetadataService } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useUIDispatch } from '../context/UIStateContext';
import { isFolderAncestor, getInternalPlugin, isTFolder, isTFile } from '../utils/typeGuards';
import { getFilesForFolder, getFilesForTag, getFolderNote } from '../utils/fileFinder';
import { strings } from '../i18n';

/**
 * Configuration for the context menu
 */
interface MenuConfig {
    /** The type of item this menu is for */
    type: 'file' | 'folder';
    /** The file or folder item the menu operates on */
    item: TFile | TFolder;
}

/**
 * Custom hook that attaches a context menu to an element.
 * Provides right-click context menu functionality for files and folders.
 * 
 * @param elementRef - React ref to the element to attach the context menu to
 * @param config - Configuration object containing menu type and item, or null to disable
 * 
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useContextMenu(ref, { type: 'file', item: file });
 * 
 * return <div ref={ref}>Right-click me</div>;
 * ```
 */
export function useContextMenu(elementRef: React.RefObject<HTMLElement | null>, config: MenuConfig | null) {
    const { app, plugin, isMobile } = useServices();
    const settings = useSettingsState();
    const fileSystemOps = useFileSystemOps();
    const metadataService = useMetadataService();
    const selectionState = useSelectionState();
    const { selectedFolder } = selectionState;
    const { expandedFolders } = useExpansionState();
    const selectionDispatch = useSelectionDispatch();
    const expansionDispatch = useExpansionDispatch();
    const uiDispatch = useUIDispatch();
    
    /**
     * Handles the context menu event.
     * Shows appropriate menu items based on whether the target is a file or folder.
     * 
     * @param e - The mouse event from right-click
     */
    const handleContextMenu = useCallback((e: MouseEvent) => {
        if (!config || !elementRef.current) return;
        
        // Check if the click is on this element or its children
        if (!elementRef.current.contains(e.target as Node)) return;
        
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();
        
        // Add context menu active class to show outline
        elementRef.current.classList.add('nn-context-menu-active');
        
        // Remove the class when menu is hidden
        menu.onHide(() => {
            if (elementRef.current) {
                elementRef.current.classList.remove('nn-context-menu-active');
            }
        });
        
        if (config.type === 'folder') {
            if (!isTFolder(config.item)) return;
            const folder = config.item;
            
            // New note
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.folder.newNote)
                    .setIcon('file-plus')
                    .onClick(async () => {
                        const file = await fileSystemOps.createNewFile(folder);
                        if (file) {
                            uiDispatch({ type: 'SET_NEWLY_CREATED_PATH', path: file.path });
                        }
                    });
            });
            
            // New folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.folder.newFolder)
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
                item
                    .setTitle(strings.contextMenu.folder.newCanvas)
                    .setIcon('layout-grid')
                    .onClick(async () => {
                        await fileSystemOps.createCanvas(folder);
                    });
            });
            
            // New base (only if Bases plugin is enabled)
            const basesPlugin = getInternalPlugin(app, 'bases');
            if (basesPlugin?.enabled) {
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle(strings.contextMenu.folder.newBase)
                        .setIcon('database')
                        .onClick(async () => {
                            await fileSystemOps.createBase(folder);
                        });
                });
            }
            
            // New drawing (only if Excalidraw plugin is installed)
            const isExcalidrawInstalled = !!(app as any).plugins?.plugins?.['obsidian-excalidraw-plugin'];
            if (isExcalidrawInstalled) {
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle('New drawing')
                        .setIcon('pencil')
                        .onClick(async () => {
                            await fileSystemOps.createNewDrawing(folder);
                        });
                });
            }
            
            menu.addSeparator();
            
            // Duplicate folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.folder.duplicateFolder)
                    .setIcon('documents')
                    .onClick(async () => {
                        await fileSystemOps.duplicateFolder(folder);
                    });
            });
            
            // Search in folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.folder.searchInFolder)
                    .setIcon('search')
                    .onClick(() => {
                        const searchPlugin = getInternalPlugin(app, 'global-search');
                        if (searchPlugin && 'instance' in searchPlugin && searchPlugin.instance) {
                            searchPlugin.instance.openGlobalSearch(`path:"${folder.path}"`);
                        }
                    });
            });
            
            // Folder note operations
            if (settings.enableFolderNotes) {
                menu.addSeparator();
                
                const folderNote = getFolderNote(folder, settings, app);
                
                if (folderNote) {
                    // Delete folder note option
                    menu.addItem((item: MenuItem) => {
                        item
                            .setTitle(strings.contextMenu.folder.deleteFolderNote)
                            .setIcon('trash')
                            .onClick(async () => {
                                await fileSystemOps.deleteFile(folderNote, settings.confirmBeforeDelete);
                            });
                    });
                } else {
                    // Create folder note option
                    menu.addItem((item: MenuItem) => {
                        item
                            .setTitle(strings.contextMenu.folder.createFolderNote)
                            .setIcon('file-plus')
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
                                
                                const file = await app.vault.create(notePath, '');
                                
                                // Set a temporary flag to prevent auto-reveal
                                (window as any).notebookNavigatorOpeningFolderNote = true;
                                
                                await app.workspace.getLeaf().openFile(file);
                                
                                // Clear the flag after a short delay
                                setTimeout(() => {
                                    delete (window as any).notebookNavigatorOpeningFolderNote;
                                }, 100);
                            });
                    });
                }
            }
            
            // Only show icon options if folder icons are enabled
            if (settings.showFolderIcons) {
                menu.addSeparator();
                
                // Change icon
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle(strings.contextMenu.folder.changeIcon)
                        .setIcon('palette')
                        .onClick(async () => {
                            const { IconPickerModal } = await import('../modals/IconPickerModal');
                            const modal = new IconPickerModal(
                                app, 
                                metadataService, 
                                folder.path,
                                settings.recentlyUsedIcons || []
                            );
                            
                            modal.onChooseIcon = (iconId) => {
                                if (iconId) {
                                    // The metadata change will trigger a re-render naturally
                                    // through Obsidian's metadata events
                                }
                            };
                            
                            modal.open();
                        });
                });
                
                // Remove icon (only show if custom icon is set)
                const currentIcon = metadataService.getFolderIcon(folder.path);
                if (currentIcon) {
                    menu.addItem((item: MenuItem) => {
                        item
                            .setTitle(strings.contextMenu.folder.removeIcon)
                            .setIcon('x')
                            .onClick(async () => {
                                await metadataService.removeFolderIcon(folder.path);
                                // The metadata change will trigger a re-render naturally
                            });
                    });
                }
            }
            
            menu.addSeparator();
            
            // Change color
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.folder.changeColor)
                    .setIcon('palette')
                    .onClick(async () => {
                        const { ColorPickerModal } = await import('../modals/ColorPickerModal');
                        const modal = new ColorPickerModal(app, metadataService, folder.path);
                        modal.onChooseColor = () => {
                            // The metadata change will trigger a re-render naturally
                        };
                        modal.open();
                    });
            });
            
            // Remove color (only show if custom color is set)
            const currentColor = metadataService.getFolderColor(folder.path);
            if (currentColor) {
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle(strings.contextMenu.folder.removeColor)
                        .setIcon('x')
                        .onClick(async () => {
                            await metadataService.removeFolderColor(folder.path);
                            // The metadata change will trigger a re-render naturally
                        });
                });
            }
            
            menu.addSeparator();
            
            // Rename folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.folder.renameFolder)
                    .setIcon('pencil')
                    .onClick(async () => {
                        await fileSystemOps.renameFolder(folder, settings);
                    });
            });
            
            // Delete folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.folder.deleteFolder)
                    .setIcon('trash')
                    .onClick(async () => {
                        const parentFolder = folder.parent;
                        
                        await fileSystemOps.deleteFolder(folder, settings.confirmBeforeDelete, () => {
                            // Check if we need to update selection
                            if (selectedFolder) {
                                const isSelectedFolderDeleted = folder.path === selectedFolder.path;
                                const isAncestorDeleted = isFolderAncestor(folder, selectedFolder);
                                
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
            
        } else {
            if (!isTFile(config.item)) return;
            const file = config.item;
            
            // Open in new tab
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.file.openInNewTab)
                    .setIcon('file-plus')
                    .onClick(() => {
                        app.workspace.getLeaf('tab').openFile(file);
                    });
            });
            
            // Open to the right
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.file.openToRight)
                    .setIcon('vertical-three-dots')
                    .onClick(() => {
                        app.workspace.getLeaf('split').openFile(file);
                    });
            });
            
            // Open in new window - desktop only
            if (!isMobile) {
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle(strings.contextMenu.file.openInNewWindow)
                        .setIcon('monitor')
                        .onClick(() => {
                            app.workspace.getLeaf('window').openFile(file);
                        });
                });
            }
            
            menu.addSeparator();
            
            // Pin/Unpin note
            const folderPath = file.parent?.path || '';
            const isPinned = metadataService.isPinned(folderPath, file.path);
            
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(isPinned ? strings.contextMenu.file.unpinNote : strings.contextMenu.file.pinNote)
                    .setIcon('pin')
                    .onClick(async () => {
                        if (!file.parent) return;
                        
                        await metadataService.togglePinnedNote(folderPath, file.path);
                        // The metadata change will trigger a re-render naturally
                    });
            });
            
            // Duplicate note
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.file.duplicateNote)
                    .setIcon('documents')
                    .onClick(async () => {
                        await fileSystemOps.duplicateNote(file);
                    });
            });
            
            // Open version history (if Sync is enabled) - desktop only
            if (!isMobile) {
                const syncPlugin = getInternalPlugin(app, 'sync');
                if (syncPlugin && 'enabled' in syncPlugin && syncPlugin.enabled) {
                    menu.addItem((item: MenuItem) => {
                        item
                            .setTitle(strings.contextMenu.file.openVersionHistory)
                            .setIcon('history')
                            .onClick(async () => {
                                await fileSystemOps.openVersionHistory(file);
                            });
                    });
                }
            }
            
            menu.addSeparator();
            
            // Reveal in system explorer - desktop only
            if (!isMobile) {
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle(fileSystemOps.getRevealInSystemExplorerText())
                        .setIcon('folder-open')
                        .onClick(async () => {
                            await fileSystemOps.revealInSystemExplorer(file);
                        });
                });
            }
            
            // Copy deep link
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.file.copyDeepLink)
                    .setIcon('link')
                    .onClick(async () => {
                        const vaultName = app.vault.getName();
                        const encodedVault = encodeURIComponent(vaultName);
                        const encodedFile = encodeURIComponent(file.path);
                        const deepLink = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;
                        
                        await navigator.clipboard.writeText(deepLink);
                        new Notice('Deep link copied to clipboard');
                    });
            });
            
            menu.addSeparator();
            
            // Rename note
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.file.renameNote)
                    .setIcon('pencil')
                    .onClick(async () => {
                        await fileSystemOps.renameFile(file);
                    });
            });
            
            // Delete note
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(strings.contextMenu.file.deleteNote)
                    .setIcon('trash')
                    .onClick(async () => {
                        // Check if this is the currently selected file
                        if (selectionState.selectedFile?.path === file.path) {
                            // Use the smart delete handler
                            await fileSystemOps.deleteSelectedFile(
                                file,
                                settings,
                                {
                                    selectionType: selectionState.selectionType,
                                    selectedFolder: selectionState.selectedFolder || undefined,
                                    selectedTag: selectionState.selectedTag || undefined
                                },
                                selectionDispatch,
                                settings.confirmBeforeDelete
                            );
                        } else {
                            // Normal deletion - not the currently selected file
                            await fileSystemOps.deleteFile(file, settings.confirmBeforeDelete);
                        }
                    });
            });
        }
        
        menu.showAtMouseEvent(e);
    }, [config?.type, config?.item, app, settings, fileSystemOps, metadataService, selectionState, expandedFolders, selectionDispatch, expansionDispatch, isMobile]);
    
    useEffect(() => {
        const element = elementRef.current;
        if (!element || !config) return;
        
        element.addEventListener('contextmenu', handleContextMenu);
        
        return () => {
            element.removeEventListener('contextmenu', handleContextMenu);
            // Clean up any lingering context menu active class
            element.classList.remove('nn-context-menu-active');
        };
    }, [elementRef, handleContextMenu, config]);
}