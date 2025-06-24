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

import { useCallback } from 'react';
import { TFile } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { Virtualizer } from '@tanstack/react-virtual';
import { findFileIndex, getFilesInRange } from '../utils/selectionUtils';

/**
 * Hook for managing multi-selection operations in file lists
 * Provides clean API for selection operations like Shift+Click, Cmd+Click, etc.
 */
export function useMultiSelection(virtualizer?: Virtualizer<HTMLDivElement, Element>) {
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    
    /**
     * Handle Cmd/Ctrl+Click for toggling individual file selection
     */
    const handleMultiSelectClick = useCallback((file: TFile, fileIndex?: number) => {
        // Check if we're trying to deselect
        const isDeselecting = selectionState.selectedFiles.has(file.path);
        
        // Don't allow deselecting if it's the last selected item
        if (isDeselecting && selectionState.selectedFiles.size === 1) {
            return;
        }
        
        // If deselecting, don't move cursor
        if (isDeselecting) {
            selectionDispatch({ type: 'TOGGLE_FILE_SELECTION', file });
        } else {
            // If selecting, update cursor
            selectionDispatch({ type: 'TOGGLE_WITH_CURSOR', file, anchorIndex: fileIndex });
        }
    }, [selectionState.selectedFiles, selectionDispatch]);
    
    /**
     * Handle Shift+Click for range selection
     */
    const handleRangeSelectClick = useCallback((
        file: TFile, 
        fileIndex: number, 
        orderedFiles: TFile[]
    ) => {
        // Find cursor position in the orderedFiles array
        const cursorIndex = findFileIndex(orderedFiles, selectionState.selectedFile);
        
        // If no cursor position (no selection), just select the clicked file
        if (cursorIndex === -1) {
            selectionDispatch({ type: 'SET_SELECTED_FILE', file });
            return;
        }
        
        // Get all files in range
        const filesInRange = getFilesInRange(orderedFiles, cursorIndex, fileIndex);
        
        // Select all files in range that aren't already selected
        filesInRange.forEach(f => {
            if (!selectionState.selectedFiles.has(f.path)) {
                selectionDispatch({ type: 'TOGGLE_FILE_SELECTION', file: f });
            }
        });
        
        // Move cursor to the clicked position
        selectionDispatch({ type: 'UPDATE_CURRENT_FILE', file });
    }, [selectionState.selectedFile, selectionState.selectedFiles, selectionDispatch]);
    
    /**
     * Handle Shift+Arrow selection with Apple Notes-style anchor jumping
     */
    const handleShiftArrowSelection = useCallback((
        direction: 'up' | 'down', 
        currentIndex: number, 
        files: TFile[]
    ) => {
        // Can't extend selection if nothing is selected
        if (currentIndex === -1 || !selectionState.selectedFile) {
            return;
        }
        
        const currentFile = selectionState.selectedFile;
        
        // Calculate next position
        const nextIndex = direction === 'down' 
            ? Math.min(currentIndex + 1, files.length - 1)
            : Math.max(currentIndex - 1, 0);
        
        // Check if we're at boundary
        if (nextIndex === currentIndex) {
            return;
        }
        
        const nextFile = files[nextIndex];
        let jumpingEnabled = true;
        
        // STEP 1: Check if we need to deselect current item
        if (selectionState.selectedFiles.has(currentFile.path)) {
            // Check where we're moving TO
            if (selectionState.selectedFiles.has(nextFile.path)) {
                // Moving FROM selected item TO another selected item - deselect current
                selectionDispatch({ type: 'TOGGLE_FILE_SELECTION', file: currentFile });
                jumpingEnabled = false;
            }
            // else: Moving FROM selected item TO unselected item - keep current selected
        }
        
        // STEP 2: Check the cell we arrived at
        const arrivedAtWasSelected = selectionState.selectedFiles.has(nextFile.path);
        
        if (!arrivedAtWasSelected) {
            // This new cell is unselected, select it
            selectionDispatch({ type: 'TOGGLE_FILE_SELECTION', file: nextFile });
        }
        
        // STEP 3: Jumping logic (only if enabled)
        let finalIndex = nextIndex;
        
        if (jumpingEnabled) {
            // Jump through consecutive selected items
            let jumpIndex = direction === 'down' ? nextIndex + 1 : nextIndex - 1;
            
            while (jumpIndex >= 0 && jumpIndex < files.length) {
                const jumpFile = files[jumpIndex];
                if (selectionState.selectedFiles.has(jumpFile.path)) {
                    finalIndex = jumpIndex;
                    jumpIndex = direction === 'down' ? jumpIndex + 1 : jumpIndex - 1;
                } else {
                    // Next item is not selected, stop here
                    break;
                }
            }
        }
        
        // STEP 4: Move cursor to final position
        const finalFile = files[finalIndex];
        selectionDispatch({ type: 'UPDATE_CURRENT_FILE', file: finalFile });
        
        // Update movement direction
        selectionDispatch({ type: 'SET_MOVEMENT_DIRECTION', direction });
        
        // Scroll to the final position if virtualizer is provided
        if (virtualizer) {
            virtualizer.scrollToIndex(finalIndex, {
                align: 'auto',
                behavior: 'auto'
            });
        }
    }, [selectionState.selectedFile, selectionState.selectedFiles, selectionDispatch, virtualizer]);
    
    /**
     * Select all files in the current view
     */
    const selectAll = useCallback((files: TFile[]) => {
        if (files.length === 0) return;
        
        // Clear current selection and select all files
        selectionDispatch({ type: 'CLEAR_FILE_SELECTION' });
        files.forEach(file => {
            selectionDispatch({ type: 'TOGGLE_FILE_SELECTION', file });
        });
        
        // Keep cursor on current file or first file if none selected
        const currentFile = selectionState.selectedFile || files[0];
        if (currentFile) {
            selectionDispatch({ type: 'UPDATE_CURRENT_FILE', file: currentFile });
        }
    }, [selectionState.selectedFile, selectionDispatch]);
    
    /**
     * Clear all selections
     */
    const clearSelection = useCallback(() => {
        selectionDispatch({ type: 'CLEAR_FILE_SELECTION' });
    }, [selectionDispatch]);
    
    /**
     * Check if a specific file is selected
     */
    const isFileSelected = useCallback((file: TFile) => {
        return selectionState.selectedFiles.has(file.path);
    }, [selectionState.selectedFiles]);
    
    return {
        // State
        selectedFiles: selectionState.selectedFiles,
        selectedFile: selectionState.selectedFile,
        selectedCount: selectionState.selectedFiles.size,
        
        // Actions
        handleMultiSelectClick,
        handleRangeSelectClick,
        handleShiftArrowSelection,
        selectAll,
        clearSelection,
        isFileSelected,
    };
}