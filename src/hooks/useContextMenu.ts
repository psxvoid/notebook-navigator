// src/hooks/useContextMenu.ts
import { useEffect, useCallback } from 'react';
import { Menu, MenuItem, TFile, TFolder, Notice } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { useFileSystemOps } from '../context/ServicesContext';

interface MenuConfig {
    type: 'file' | 'folder';
    item: TFile | TFolder;
}

export function useContextMenu(elementRef: React.RefObject<HTMLElement>, config: MenuConfig | null) {
    const { app, plugin, dispatch } = useAppContext();
    const fileSystemOps = useFileSystemOps();
    
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
            const folder = config.item as TFolder;
            
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
                        await fileSystemOps.createNewFolder(folder);
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
            
            // New database (only if Obsidian supports it)
            if ((app as any).vault.adapter.createBase) {
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
                        const searchPlugin = (app as any).internalPlugins?.getPluginById('global-search');
                        if (searchPlugin?.instance) {
                            searchPlugin.instance.openGlobalSearch(`path:"${folder.path}"`);
                        }
                    });
            });
            
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
                        await fileSystemOps.deleteFolder(folder, plugin.settings.confirmBeforeDelete);
                    });
            });
            
        } else {
            const file = config.item as TFile;
            
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
            const syncPlugin = (app as any).internalPlugins?.getPluginById('sync');
            if (syncPlugin?.enabled) {
                menu.addItem((item: MenuItem) => {
                    item
                        .setTitle('Open version history')
                        .setIcon('history')
                        .onClick(() => {
                            (app as any).commands.executeCommandById('sync:view-version-history');
                        });
                });
            }
            
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
    }, [config, elementRef, app, plugin, dispatch, fileSystemOps]);
    
    useEffect(() => {
        const element = elementRef.current;
        if (!element || !config) return;
        
        element.addEventListener('contextmenu', handleContextMenu);
        
        return () => {
            element.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [elementRef, handleContextMenu, config]);
}