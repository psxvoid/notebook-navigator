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

import { TFile } from 'obsidian';

/**
 * Utilities for managing file selection operations
 */

/**
 * Find the next file to select after deleting files
 * @param allFiles - All files in the current view
 * @param deletedPaths - Set of paths that are being deleted
 * @returns The file to select after deletion, or null if none
 */
export function findNextFileAfterDelete(
    allFiles: TFile[], 
    deletedPaths: Set<string>
): TFile | null {
    if (allFiles.length === 0) return null;
    
    // Find the first deleted file's index
    let firstDeletedIndex = -1;
    for (let i = 0; i < allFiles.length; i++) {
        if (deletedPaths.has(allFiles[i].path)) {
            firstDeletedIndex = i;
            break;
        }
    }
    
    if (firstDeletedIndex === -1) return null;
    
    // Strategy 1: Find first unselected file starting from first deleted position
    for (let i = firstDeletedIndex; i < allFiles.length; i++) {
        if (!deletedPaths.has(allFiles[i].path)) {
            return allFiles[i];
        }
    }
    
    // Strategy 2: If no file found after, look for first file before the selection
    if (firstDeletedIndex > 0) {
        for (let i = firstDeletedIndex - 1; i >= 0; i--) {
            if (!deletedPaths.has(allFiles[i].path)) {
                return allFiles[i];
            }
        }
    }
    
    return null;
}

/**
 * Get files in range for shift-click selection
 * @param files - All files in order
 * @param startIndex - Starting index
 * @param endIndex - Ending index
 * @returns Array of files in the range
 */
export function getFilesInRange(
    files: TFile[], 
    startIndex: number, 
    endIndex: number
): TFile[] {
    const minIndex = Math.max(0, Math.min(startIndex, endIndex));
    const maxIndex = Math.min(files.length - 1, Math.max(startIndex, endIndex));
    
    const result: TFile[] = [];
    for (let i = minIndex; i <= maxIndex; i++) {
        if (files[i]) {
            result.push(files[i]);
        }
    }
    
    return result;
}

/**
 * Find the index of a file in an ordered list
 * @param files - Ordered list of files
 * @param targetFile - File to find
 * @returns Index of the file, or -1 if not found
 */
export function findFileIndex(files: TFile[], targetFile: TFile | null): number {
    if (!targetFile) return -1;
    return files.findIndex(f => f.path === targetFile.path);
}

/**
 * Check if we should show multi-selection options in context menu
 * @param selectedFiles - Set of selected file paths
 * @param clickedFilePath - Path of the file that was right-clicked
 * @returns True if multi-selection options should be shown
 */
export function shouldShowMultiSelectOptions(
    selectedFiles: Set<string>, 
    clickedFilePath: string
): boolean {
    return selectedFiles.size > 1 && selectedFiles.has(clickedFilePath);
}