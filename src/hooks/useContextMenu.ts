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
import { Menu, MenuItem, TFile, TFolder, Notice } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { useFileSystemOps } from '../context/ServicesContext';
import { isFolderAncestor, getInternalPlugin, isTFolder, isTFile } from '../utils/typeGuards';

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
    const { app, plugin, dispatch, appState } = useAppContext();
    const fileSystemOps = useFileSystemOps();
    
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

        // Add this line to apply the class
        const element = elementRef.current;
        element.classList.add('nn-context-menu-active');
        
        const menu = new Menu();
        
        // This is a handler to clean up the class
        const cleanup = () => {
            element.classList.remove('nn-context-menu-active');
            menu.hide();
        };

        menu.onHide(cleanup); // Use the built-in onHide callback
        
        if (config.type === 'folder') {
            if (!isTFolder(config.item)) return;
            const folder = config.item;
            
            // New note
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('New note')
                    .setIcon('file-plus')
                    .onClick(async () => {
                        await fileSystemOps.createNewFile(folder);
                    });
            });
            
            // New folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('New folder')
                    .setIcon('folder-plus')
                    .onClick(async () => {
                        await fileSystemOps.createNewFolder(folder, () => {
                            // Expand the parent folder to show the newly created folder
                            if (!appState.expandedFolders.has(folder.path)) {
                                dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                            }
                        });
                    });
            });
            
            // New canvas
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('New canvas')
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
                        .setTitle('New base')
                        .setIcon('database')
                        .onClick(async () => {
                            await fileSystemOps.createBase(folder);
                        });
                });
            }
            
            menu.addSeparator();
            
            // Duplicate folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Duplicate folder')
                    .setIcon('documents')
                    .onClick(async () => {
                        await fileSystemOps.duplicateFolder(folder);
                    });
            });
            
            // Search in folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Search in folder')
                    .setIcon('search')
                    .onClick(() => {
                        const searchPlugin = getInternalPlugin(app, 'global-search');
                        if (searchPlugin && 'instance' in searchPlugin && searchPlugin.instance) {
                            searchPlugin.instance.openGlobalSearch(`path:"${folder.path}"`);
                        }
                    });
            });
            
            menu.addSeparator();
            
            // Change icon
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Change icon')
                    .setIcon('palette')
                    .onClick(async () => {
                        const { IconPickerModal } = await import('../modals/IconPickerModal');
                        const modal = new IconPickerModal(app, plugin, folder.path);
                        
                        modal.onChooseIcon = (iconId) => {
                            if (iconId) {
                                dispatch({ type: 'FORCE_REFRESH' });
                            }
                        };
                        
                        modal.open();
                    });
            });
            
            // Remove icon (only show if custom icon is set)
            const currentIcon = plugin.settings.folderIcons?.[folder.path];
            if (currentIcon) {
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle('Remove icon')
                        .setIcon('x')
                        .onClick(async () => {
                            delete plugin.settings.folderIcons[folder.path];
                            await plugin.saveSettings();
                            dispatch({ type: 'FORCE_REFRESH' });
                        });
                });
            }
            
            menu.addSeparator();
            
            // Change color
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Change color')
                    .setIcon('palette')
                    .onClick(() => {
                        const { ColorPickerModal } = require('../modals/ColorPickerModal');
                        const modal = new ColorPickerModal(app, plugin, folder.path);
                        modal.onChooseColor = () => {
                            dispatch({ type: 'FORCE_REFRESH' });
                        };
                        modal.open();
                    });
            });
            
            // Remove color (only show if custom color is set)
            const currentColor = plugin.settings.folderColors?.[folder.path];
            if (currentColor) {
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle('Remove color')
                        .setIcon('x')
                        .onClick(async () => {
                            delete plugin.settings.folderColors[folder.path];
                            await plugin.saveSettings();
                            dispatch({ type: 'FORCE_REFRESH' });
                        });
                });
            }
            
            menu.addSeparator();
            
            // Rename folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Rename folder')
                    .setIcon('pencil')
                    .onClick(async () => {
                        await fileSystemOps.renameFolder(folder);
                    });
            });
            
            // Delete folder
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Delete folder')
                    .setIcon('trash')
                    .onClick(async () => {
                        const parentFolder = folder.parent;
                        
                        await fileSystemOps.deleteFolder(folder, plugin.settings.confirmBeforeDelete, () => {
                            // Check if we need to update selection
                            if (appState.selectedFolder) {
                                const isSelectedFolderDeleted = folder.path === appState.selectedFolder.path;
                                const isAncestorDeleted = isFolderAncestor(folder, appState.selectedFolder);
                                
                                if (isSelectedFolderDeleted || isAncestorDeleted) {
                                    // If parent exists and is not root (or root is visible), select it
                                    if (parentFolder && (parentFolder.path !== '' || plugin.settings.showRootFolder)) {
                                        dispatch({ type: 'SET_SELECTED_FOLDER', folder: parentFolder });
                                    } else {
                                        // Clear selection if no valid parent
                                        dispatch({ type: 'SET_SELECTED_FOLDER', folder: null });
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
                    .setTitle('Open in new tab')
                    .setIcon('file-plus')
                    .onClick(() => {
                        app.workspace.getLeaf('tab').openFile(file);
                    });
            });
            
            // Open to the right
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Open to the right')
                    .setIcon('layout-sidebar-right')
                    .onClick(() => {
                        app.workspace.getLeaf('split').openFile(file);
                    });
            });
            
            // Open in new window
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Open in new window')
                    .setIcon('monitor')
                    .onClick(() => {
                        app.workspace.getLeaf('window').openFile(file);
                    });
            });
            
            menu.addSeparator();
            
            // Pin/Unpin note
            const pinnedNotes = plugin.settings.pinnedNotes[file.parent?.path || ''] || [];
            const isPinned = pinnedNotes.includes(file.path);
            
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(isPinned ? 'Unpin note' : 'Pin note')
                    .setIcon(isPinned ? 'unpin' : 'pin')
                    .onClick(async () => {
                        if (!file.parent) return;
                        
                        const folderPath = file.parent.path;
                        const currentPinned = plugin.settings.pinnedNotes[folderPath] || [];
                        
                        if (isPinned) {
                            plugin.settings.pinnedNotes[folderPath] = currentPinned.filter(p => p !== file.path);
                        } else {
                            plugin.settings.pinnedNotes[folderPath] = [...currentPinned, file.path];
                        }
                        
                        await plugin.saveSettings();
                        dispatch({ type: 'FORCE_REFRESH' });
                    });
            });
            
            // Duplicate note
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Duplicate note')
                    .setIcon('documents')
                    .onClick(async () => {
                        await fileSystemOps.duplicateNote(file);
                    });
            });
            
            // Open version history (if Sync is enabled)
            const syncPlugin = getInternalPlugin(app, 'sync');
            if (syncPlugin && 'enabled' in syncPlugin && syncPlugin.enabled) {
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle('Open version history')
                        .setIcon('history')
                        .onClick(async () => {
                            await fileSystemOps.openVersionHistory(file);
                        });
                });
            }
            
            menu.addSeparator();
            
            // Reveal in system explorer
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle(fileSystemOps.getRevealInSystemExplorerText())
                    .setIcon('folder-open')
                    .onClick(async () => {
                        await fileSystemOps.revealInSystemExplorer(file);
                    });
            });
            
            menu.addSeparator();
            
            // Rename note
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Rename note')
                    .setIcon('pencil')
                    .onClick(async () => {
                        await fileSystemOps.renameFile(file);
                    });
            });
            
            // Delete note
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Delete note')
                    .setIcon('trash')
                    .onClick(async () => {
                        await fileSystemOps.deleteFile(file, plugin.settings.confirmBeforeDelete);
                    });
            });
        }
        
        menu.showAtMouseEvent(e);
    }, [config, elementRef, app, plugin, dispatch, fileSystemOps, appState]);
    
    useEffect(() => {
        const element = elementRef.current;
        if (!element || !config) return;
        
        element.addEventListener('contextmenu', handleContextMenu);
        
        return () => {
            element.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [elementRef, handleContextMenu, config]);
}