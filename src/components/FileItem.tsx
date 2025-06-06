// src/components/FileItem.tsx
import React, { useEffect, useState, useRef } from 'react';
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

    const formattedDate = DateUtils.formatDate(file.stat.mtime, plugin.settings.dateFormat);

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
    }, [file.path, app.vault, plugin.settings]); // Rerun effect if file path changes
    
    const className = `nn-file-item ${isSelected ? 'nn-selected' : ''}`;

    return (
        <div ref={fileRef} className={className} data-path={file.path} onClick={onClick} draggable="true">
            <div className="nn-file-content">
                <div className="nn-file-text-content">
                    <div className="nn-file-name">{file.basename}</div>
                    <div className="nn-file-second-line">
                        <div className="nn-file-date">{formattedDate}</div>
                        <div className="nn-file-preview">{previewText}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}