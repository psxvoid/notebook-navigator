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

import { useEffect, useRef } from 'react';
import { SelectionState } from '../context/SelectionContext';

/**
 * Debug hook for logging multi-selection state changes
 * Helps track selection changes, anchor movements, and keyboard events
 * 
 * @param selectionState - The current selection state from SelectionContext
 * @param enabled - Whether debug logging is enabled (default: true)
 */
export function useMultiSelectionDebug(selectionState: SelectionState, enabled = true) {
    const prevState = useRef<SelectionState>(selectionState);
    
    useEffect(() => {
        if (!enabled) return;
        
        const prev = prevState.current;
        const curr = selectionState;
        
        // Check what changed
        const changes: string[] = [];
        
        // Selected files changed
        if (prev.selectedFiles !== curr.selectedFiles) {
            const prevPaths = Array.from(prev.selectedFiles);
            const currPaths = Array.from(curr.selectedFiles);
            
            // Find added files
            const added = currPaths.filter(path => !prev.selectedFiles.has(path));
            const removed = prevPaths.filter(path => !curr.selectedFiles.has(path));
            
            if (added.length > 0) {
                changes.push(`Added files: ${added.join(', ')}`);
            }
            if (removed.length > 0) {
                changes.push(`Removed files: ${removed.join(', ')}`);
            }
            changes.push(`Total selected: ${curr.selectedFiles.size}`);
        }
        
        // Anchor changed
        if (prev.anchorIndex !== curr.anchorIndex) {
            changes.push(`Anchor: ${prev.anchorIndex} → ${curr.anchorIndex}`);
        }
        
        // Movement direction changed
        if (prev.lastMovementDirection !== curr.lastMovementDirection) {
            changes.push(`Direction: ${prev.lastMovementDirection || 'none'} → ${curr.lastMovementDirection || 'none'}`);
        }
        
        // Single file selection changed (backward compatibility)
        if (prev.selectedFile?.path !== curr.selectedFile?.path) {
            changes.push(`Selected file: ${prev.selectedFile?.name || 'none'} → ${curr.selectedFile?.name || 'none'}`);
        }
        
        // Log changes if any
        if (changes.length > 0) {
            console.groupCollapsed('[MULTI-SELECT] State changed');
            changes.forEach(change => console.log(change));
            console.log('Full state:', {
                selectedFiles: Array.from(curr.selectedFiles),
                anchorIndex: curr.anchorIndex,
                lastMovementDirection: curr.lastMovementDirection,
                selectedFile: curr.selectedFile?.path
            });
            console.groupEnd();
        }
        
        // Update previous state reference
        prevState.current = selectionState;
    }, [selectionState, enabled]);
    
    // Log keyboard events for debugging
    useEffect(() => {
        if (!enabled) return;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only log relevant keys
            const relevantKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'];
            const modifierKeys = e.shiftKey || e.metaKey || e.ctrlKey || e.altKey;
            
            if (relevantKeys.includes(e.key) || modifierKeys) {
                const modifiers = [];
                if (e.shiftKey) modifiers.push('Shift');
                if (e.metaKey) modifiers.push('Cmd');
                if (e.ctrlKey) modifiers.push('Ctrl');
                if (e.altKey) modifiers.push('Alt');
                
                const keyCombo = modifiers.length > 0 
                    ? `${modifiers.join('+')}+${e.key}`
                    : e.key;
                
                console.log(`[MULTI-SELECT] Key pressed: ${keyCombo}`);
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);
}