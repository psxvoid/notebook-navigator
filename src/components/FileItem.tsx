// src/components/FileItem.tsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { TFile } from 'obsidian';
import { useAppContext } from '../context/AppContext';
import { DateUtils } from '../utils/DateUtils';
import { PreviewTextUtils } from '../utils/PreviewTextUtils';
import { useContextMenu } from '../hooks/useContextMenu';

interface FileItemProps {
    file: TFile;
    isSelected: boolean;
    onClick: () => void;
}

export function FileItem({ file, isSelected, onClick }: FileItemProps) {
    const { app, plugin } = useAppContext();
    const [previewText, setPreviewText] = useState('...');
    const fileRef = useRef<HTMLDivElement>(null);
    
    // Enable context menu
    useContextMenu(fileRef, { type: 'file', item: file });
    
    // Ensure selected item is visible when it becomes selected
    useEffect(() => {
        if (isSelected && fileRef.current) {
            fileRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [isSelected]);

    // Show date based on sort option - created date when sorted by created, modified date otherwise
    const dateToShow = plugin.settings.sortOption === 'created' ? file.stat.ctime : file.stat.mtime;
    const formattedDate = DateUtils.formatDate(dateToShow, plugin.settings.dateFormat);

    // Calculate feature image URL if enabled
    const featureImageUrl = useMemo(() => {
        if (!plugin.settings.showFeatureImage) {
            return null;
        }

        const metadata = app.metadataCache.getFileCache(file);
        const imagePath = metadata?.frontmatter?.[plugin.settings.featureImageProperty];

        if (!imagePath) {
            return null;
        }

        // Handle wikilinks e.g., [[image.png]]
        const resolvedPath = imagePath.startsWith('[[') && imagePath.endsWith(']]')
            ? imagePath.slice(2, -2)
            : imagePath;

        const imageFile = app.metadataCache.getFirstLinkpathDest(resolvedPath, file.path);
        if (imageFile) {
            return app.vault.getResourcePath(imageFile);
        }

        return null;
    }, [file.path, plugin.settings.showFeatureImage, plugin.settings.featureImageProperty]);

    // useEffect is how you perform side effects, like reading file content.
    useEffect(() => {
        let isCancelled = false;
        if (file.extension === 'md') {
            app.vault.cachedRead(file).then(content => {
                if (!isCancelled) {
                    setPreviewText(PreviewTextUtils.extractPreviewText(content, plugin.settings));
                }
            });
        } else {
            setPreviewText(file.extension.toUpperCase());
        }
        // This cleanup function prevents state updates on unmounted components
        return () => { isCancelled = true; };
    }, [file.path, app.vault, plugin.settings.skipHeadingsInPreview, plugin.settings.skipNonTextInPreview]); // Rerun effect if file path or preview settings change
    
    const className = `nn-file-item ${isSelected ? 'nn-selected' : ''}`;

    return (
        <div 
            ref={fileRef} 
            className={className} 
            data-path={file.path} 
            data-drag-path={file.path}
            data-drag-type="file"
            data-draggable="true"
            onClick={onClick} 
            draggable="true"
        >
            <div className="nn-file-content">
                <div className="nn-file-text-content">
                    <div className="nn-file-name">{file.basename}</div>
                    <div className="nn-file-second-line">
                        <div className="nn-file-date">{formattedDate}</div>
                        <div className="nn-file-preview">{previewText}</div>
                    </div>
                </div>
                {featureImageUrl && (
                    <div className="nn-feature-image">
                        <img src={featureImageUrl} alt="Feature image" className="nn-feature-image-img" />
                    </div>
                )}
            </div>
        </div>
    );
}