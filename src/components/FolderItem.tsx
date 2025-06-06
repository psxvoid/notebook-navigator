import React, { useRef, useEffect } from 'react';
import { TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { setIcon } from 'obsidian';
import { isTFile, isTFolder } from '../utils/typeGuards';
import { useContextMenu } from '../hooks/useContextMenu';

interface FolderItemProps {
    folder: TFolder;
    level: number;
    isExpanded: boolean;
    isSelected: boolean;
    onToggle: () => void;
    onClick: () => void;
}

export function FolderItem({ folder, level, isExpanded, isSelected, onToggle, onClick }: FolderItemProps) {
    const { app, plugin, refreshCounter } = useAppContext();
    const folderRef = useRef<HTMLDivElement>(null);
    
    // Enable context menu
    useContextMenu(folderRef, { type: 'folder', item: folder });
    
    // Count files in folder (including subfolders if setting enabled)
    const fileCount = React.useMemo(() => {
        if (!plugin.settings.showFolderFileCount) return 0;
        
        const countFiles = (folder: TFolder): number => {
            let count = 0;
            for (const child of folder.children) {
                if (isTFile(child)) {
                    if (child.extension === 'md' || child.extension === 'canvas' || child.extension === 'base') {
                        count++;
                    }
                } else if (plugin.settings.showNotesFromSubfolders && isTFolder(child)) {
                    count += countFiles(child);
                }
            }
            return count;
        };
        
        return countFiles(folder);
    }, [folder.path, folder.children.length, plugin.settings.showFolderFileCount, plugin.settings.showNotesFromSubfolders, refreshCounter]);

    const hasChildren = folder.children.some(isTFolder);
    
    const handleDoubleClick = () => {
        if (hasChildren) {
            onToggle();
        }
    };
    
    const chevronRef = React.useRef<HTMLDivElement>(null);
    const iconRef = React.useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (chevronRef.current) {
            setIcon(chevronRef.current, isExpanded ? 'chevron-down' : 'chevron-right');
        }
    }, [isExpanded]);

    // Add this useEffect for the folder icon
    useEffect(() => {
        if (iconRef.current) {
            const customIcon = plugin.settings.folderIcons?.[folder.path];
            if (customIcon) {
                // Custom icon is set - always show it, never toggle
                setIcon(iconRef.current, customIcon);
            } else {
                // Default icon - show open folder only if has children AND is expanded
                const iconName = (hasChildren && isExpanded) ? 'folder-open' : 'folder-closed';
                setIcon(iconRef.current, iconName);
            }
        }
    }, [isExpanded, folder.path, plugin.settings.folderIcons, hasChildren]);

    return (
        <div 
            ref={folderRef}
            className={`nn-folder-item ${isSelected ? 'nn-selected' : ''}`}
            data-path={folder.path}
            data-drag-path={folder.path}
            data-drag-type="folder"
            data-draggable="true"
            draggable="true"
        >
            <div 
                className="nn-folder-content"
                onClick={onClick}
                onDoubleClick={handleDoubleClick}
                data-drop-zone="folder"
                data-drop-path={folder.path}
                data-clickable="folder"
                style={{ paddingLeft: `${level * 20}px` }}
            >
                <div 
                    className="nn-folder-chevron"
                    ref={chevronRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) onToggle();
                    }}
                    style={{ 
                        visibility: hasChildren ? 'visible' : 'hidden',
                        cursor: hasChildren ? 'pointer' : 'default'
                    }}
                />
                <span className="nn-folder-icon" ref={iconRef}></span>
                <span className="nn-folder-name">{folder.path === '/' || folder.path === '' ? 'Vault' : folder.name}</span>
                {plugin.settings.showFolderFileCount && fileCount > 0 && (
                    <span className="nn-folder-count">{fileCount}</span>
                )}
            </div>
        </div>
    );
}