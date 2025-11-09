import type { App } from 'obsidian';
import { TFile, TFolder } from 'obsidian';
import type { NotebookNavigatorSettings } from '../settings/types';
import type { NoteCountInfo } from '../types/noteCounts';
import { shouldDisplayFile } from './fileTypeUtils';
import { shouldExcludeFile, shouldExcludeFolder } from './fileFilters';
import { isFolderNote, type FolderNoteDetectionSettings } from './folderNotes';

/**
 * Options for calculating note counts in folders
 */
export interface FolderNoteCountOptions {
    app: App;
    fileVisibility: NotebookNavigatorSettings['fileVisibility'];
    excludedFiles: string[];
    excludedFolders: string[];
    includeDescendants: boolean;
    showHiddenFolders: boolean;
    hideFolderNoteInList: boolean;
    folderNoteSettings: FolderNoteDetectionSettings;
    cache?: Map<string, NoteCountInfo>;
}

/**
 * Recursively calculates note counts for a folder and its descendants.
 * Respects visibility settings, exclusion patterns, and folder note handling.
 */
export function calculateFolderNoteCounts(folder: TFolder, options: FolderNoteCountOptions): NoteCountInfo {
    // Check cache for previously computed counts
    const cached = options.cache?.get(folder.path);
    if (cached) {
        return cached;
    }

    let current = 0;
    let descendants = 0;

    // Process each child item in the folder
    for (const child of folder.children) {
        if (child instanceof TFile) {
            // Skip folder notes if they should be hidden from the list
            if (
                options.folderNoteSettings.enableFolderNotes &&
                options.hideFolderNoteInList &&
                isFolderNote(child, folder, options.folderNoteSettings)
            ) {
                continue;
            }

            // Count files that pass visibility and exclusion checks
            if (
                shouldDisplayFile(child, options.fileVisibility, options.app) &&
                !shouldExcludeFile(child, options.excludedFiles, options.app)
            ) {
                current += 1;
            }
        } else if (child instanceof TFolder) {
            // Skip processing subfolders if descendants are not included
            if (!options.includeDescendants) {
                continue;
            }

            // Skip excluded/hidden folders
            if (!options.showHiddenFolders && shouldExcludeFolder(child.name, options.excludedFolders, child.path)) {
                continue;
            }

            // Recursively count notes in subfolder
            const childCounts = calculateFolderNoteCounts(child, options);
            descendants += childCounts.total;
        }
    }

    // Build count info based on includeDescendants setting
    const info: NoteCountInfo = options.includeDescendants
        ? { current, descendants, total: current + descendants }
        : { current, descendants: 0, total: current };

    // Cache the result for future use
    options.cache?.set(folder.path, info);
    return info;
}
