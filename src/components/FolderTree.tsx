import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { FolderItem } from './FolderItem';
import { isTFile, isTFolder } from '../utils/typeGuards';

interface FolderChildrenContainerProps {
    isExpanded: boolean;
    folderPath: string;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    children: React.ReactNode;
}

// Component to handle folder children with scroll behavior
const FolderChildrenContainer = React.memo(({ 
    isExpanded, 
    folderPath, 
    scrollContainerRef, 
    children 
}: FolderChildrenContainerProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    
    const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
        // Only handle our own transition, not bubbled ones
        if (e.target !== containerRef.current) return;
        
        // Only handle grid-template-rows transition
        if (e.propertyName !== 'grid-template-rows') return;
        
        // Only scroll into view if we just expanded
        if (isExpanded && containerRef.current && scrollContainerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const scrollRect = scrollContainerRef.current.getBoundingClientRect();
            
            // Check if content needs scrolling
            if (rect.bottom > scrollRect.bottom) {
                // Content is below viewport - scroll down
                const scrollBy = Math.min(
                    rect.bottom - scrollRect.bottom + 20, // +20 for padding
                    rect.height // Don't scroll more than the height of the content
                );
                
                scrollContainerRef.current.scrollBy({
                    top: scrollBy,
                    behavior: 'smooth'
                });
            } else if (rect.top < scrollRect.top) {
                // Content is above viewport - scroll up
                scrollContainerRef.current.scrollBy({
                    top: rect.top - scrollRect.top - 20, // -20 for padding
                    behavior: 'smooth'
                });
            }
        }
    }, [isExpanded, scrollContainerRef]);
    
    return (
        <div 
            ref={containerRef}
            className={`nn-folder-children ${isExpanded ? 'nn-expanded' : ''}`}
            onTransitionEnd={handleTransitionEnd}
        >
            <div className="nn-folder-children-inner">
                {children}
            </div>
        </div>
    );
});

FolderChildrenContainer.displayName = 'FolderChildrenContainer';

export function FolderTree() {
    const { app, appState, dispatch, plugin, refreshCounter } = useAppContext();
    const treeRef = useRef<HTMLDivElement>(null);
    
    const rootFolder = app.vault.getRoot();
    
    // Filter out ignored folders
    const ignoredFolders = useMemo(() => {
        return new Set(
            plugin.settings.ignoreFolders
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0)
        );
    }, [plugin.settings.ignoreFolders]);
    
    const handleFolderClick = useCallback((folder: TFolder) => {
        dispatch({ type: 'SET_SELECTED_FOLDER', folder });
        dispatch({ type: 'SET_FOCUSED_PANE', pane: 'folders' });
    }, [dispatch]);
    
    const handleToggleExpanded = useCallback((folderPath: string) => {
        dispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath });
    }, [dispatch]);
    
    const renderFolder = (folder: TFolder, level: number = 0): React.ReactNode => {
        // Skip ignored folders
        if (ignoredFolders.has(folder.name)) {
            return null;
        }
        
        const isExpanded = appState.expandedFolders.has(folder.path);
        const isSelected = appState.selectedFolder?.path === folder.path;
        
        // Get child folders, sorted alphabetically
        const childFolders = folder.children
            .filter(isTFolder)
            .sort((a, b) => a.name.localeCompare(b.name));
        
        return (
            <React.Fragment key={folder.path}>
                <FolderItem
                    folder={folder}
                    level={level}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    onToggle={() => handleToggleExpanded(folder.path)}
                    onClick={() => handleFolderClick(folder)}
                />
                <FolderChildrenContainer 
                    isExpanded={isExpanded} 
                    folderPath={folder.path}
                    scrollContainerRef={treeRef}
                >
                    {childFolders.map(childFolder => 
                        renderFolder(childFolder, level + 1)
                    )}
                </FolderChildrenContainer>
            </React.Fragment>
        );
    };
    
    // Get root level folders
    const rootFolders = useMemo(() => {
        return rootFolder.children
            .filter(isTFolder)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rootFolder, refreshCounter]); // Include refreshCounter to update on vault changes
    
    return (
        <div className="nn-folder-tree" ref={treeRef}>
            {plugin.settings.showRootFolder ? (
                // When showing root folder, render it as the top level with its children
                renderFolder(rootFolder)
            ) : (
                // Otherwise just render the root level folders
                rootFolders.map(folder => renderFolder(folder))
            )}
        </div>
    );
}