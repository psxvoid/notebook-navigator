import React from 'react';
import { TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { setIcon } from 'obsidian';
import { isTFile, isTFolder } from '../utils/typeGuards';

interface FolderItemProps {
    folder: TFolder;
    level: number;
    isExpanded: boolean;
    isSelected: boolean;
    onToggle: () => void;
    onClick: () => void;
}

export function FolderItem({ folder, level, isExpanded, isSelected, onToggle, onClick }: FolderItemProps) {
    const { app, plugin } = useAppContext();
    
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
    }, [folder, plugin.settings.showFolderFileCount, plugin.settings.showNotesFromSubfolders, app]);

    const hasChildren = folder.children.some(isTFolder);
    
    const chevronRef = React.useRef<HTMLDivElement>(null);
    
    React.useEffect(() => {
        if (chevronRef.current) {
            setIcon(chevronRef.current, isExpanded ? 'chevron-down' : 'chevron-right');
        }
    }, [isExpanded]);

    return (
        <div 
            className={`nn-folder-item ${isSelected ? 'nn-selected' : ''}`}
            data-path={folder.path}
            style={{ paddingLeft: `${level * 16}px` }}
        >
            <div 
                className="nn-folder-chevron"
                ref={chevronRef}
                onClick={(e) => {
                    e.stopPropagation();
                    if (hasChildren) onToggle();
                }}
                style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            />
            <div 
                className="nn-folder-content"
                onClick={onClick}
                data-drop-zone="folder"
                data-clickable="folder"
            >
                <span className="nn-folder-name">{folder.name}</span>
                {plugin.settings.showFolderFileCount && fileCount > 0 && (
                    <span className="nn-folder-count">{fileCount}</span>
                )}
            </div>
        </div>
    );
}