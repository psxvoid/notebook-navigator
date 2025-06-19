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

import { useState, useEffect } from 'react';
import { TFile, App, CachedMetadata } from 'obsidian';
import { PreviewTextUtils } from '../utils/PreviewTextUtils';
import { NotebookNavigatorSettings } from '../settings';

interface UseFilePreviewOptions {
    file: TFile;
    metadata: CachedMetadata | null;
    settings: NotebookNavigatorSettings;
    app: App;
}

/**
 * Custom hook that handles async loading of file preview text.
 * Encapsulates all the complex logic for determining file types,
 * handling Excalidraw files, and loading preview text with proper
 * cleanup and error handling.
 * 
 * @param options - Configuration object with file, metadata, settings, and app
 * @returns The preview text to display for the file
 */
export function useFilePreview({ file, metadata, settings, app }: UseFilePreviewOptions): string {
    const [previewText, setPreviewText] = useState('');

    useEffect(() => {
        // Only load preview text if the setting is enabled
        if (!settings.showFilePreview) {
            setPreviewText('');
            return;
        }
        
        // For non-markdown files, set extension immediately
        if (file.extension !== 'md') {
            setPreviewText(file.extension.toUpperCase());
            return;
        }
        
        // Check if this is an Excalidraw file
        // Method 1: Check by filename pattern
        if (file.name.endsWith('.excalidraw.md')) {
            setPreviewText('EXCALIDRAW');
            return;
        }
        
        // Method 2: Check by frontmatter excalidraw-plugin key
        if (metadata?.frontmatter?.['excalidraw-plugin']) {
            setPreviewText('EXCALIDRAW');
            return;
        }
        
        // Method 3: Check by frontmatter tags
        const frontmatterTags = metadata?.frontmatter?.tags;
        if (frontmatterTags) {
            // Handle both array format and single string format
            const tags = Array.isArray(frontmatterTags) ? frontmatterTags : [frontmatterTags];
            if (tags.includes('excalidraw')) {
                setPreviewText('EXCALIDRAW');
                return;
            }
        }
        
        // Create an abort controller for cancellation
        const abortController = new AbortController();
        let isCancelled = false;
        
        // Create an async function to handle the file read
        const loadPreview = async () => {
            try {
                if (isCancelled) return;
                
                const content = await app.vault.cachedRead(file);
                
                if (!isCancelled) {
                    setPreviewText(PreviewTextUtils.extractPreviewText(content, settings));
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('Failed to read file preview:', error);
                    setPreviewText(''); // Clear preview on error
                }
            }
        };
        
        // Start loading the preview
        loadPreview();
        
        // Cleanup function
        return () => { 
            isCancelled = true;
            abortController.abort();
        };
    }, [file.path, file.stat.mtime, metadata, app.vault, settings.showFilePreview, settings.skipHeadingsInPreview, settings.skipNonTextInPreview]);
    
    return previewText;
}