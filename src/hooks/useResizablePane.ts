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

// src/hooks/useResizablePane.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { NAVIGATION_PANE_DIMENSIONS } from '../types';
import { localStorage } from '../utils/localStorage';

interface UseResizablePaneConfig {
    initialWidth?: number;
    min?: number;
    storageKey?: string;
}

interface UseResizablePaneResult {
    paneWidth: number;
    isResizing: boolean;
    resizeHandleProps: {
        onMouseDown: (e: React.MouseEvent) => void;
    };
}

/**
 * Custom hook for managing resizable pane width with optional localStorage persistence.
 * Handles mouse events for dragging the resize handle and constrains the width
 * within specified bounds.
 *
 * @param config - Configuration object with initial width, min bound, and storage key
 * @returns Current pane width and props to spread on the resize handle element
 */
export function useResizablePane({
    initialWidth = NAVIGATION_PANE_DIMENSIONS.defaultWidth,
    min = NAVIGATION_PANE_DIMENSIONS.minWidth,
    storageKey
}: UseResizablePaneConfig = {}): UseResizablePaneResult {
    // Track cleanup function for current resize operation
    const cleanupRef = useRef<(() => void) | null>(null);

    // Load initial width from localStorage if storage key is provided
    const [paneWidth, setPaneWidth] = useState(() => {
        if (storageKey) {
            const savedWidth = localStorage.get<number>(storageKey);
            if (savedWidth) {
                return Math.max(min, savedWidth);
            }
        }
        return initialWidth;
    });

    // Track resizing state
    const [isResizing, setIsResizing] = useState(false);

    const handleResizeMouseDown = useCallback(
        (e: React.MouseEvent) => {
            const startX = e.clientX;
            const startWidth = paneWidth;
            let currentWidth = startWidth;

            // Check if RTL mode is active
            const isRTL = document.body.classList.contains('mod-rtl');

            // Set resizing state
            setIsResizing(true);

            const handleMouseMove = (moveEvent: MouseEvent) => {
                let deltaX = moveEvent.clientX - startX;
                // In RTL mode, reverse the delta to make dragging feel natural
                if (isRTL) {
                    deltaX = -deltaX;
                }
                currentWidth = Math.max(min, startWidth + deltaX);
                setPaneWidth(currentWidth);
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                // Save final width to localStorage on mouseup
                if (storageKey) {
                    localStorage.set(storageKey, currentWidth);
                }
                // Clear resizing state
                setIsResizing(false);
                // Clear the cleanup ref since we've already cleaned up
                cleanupRef.current = null;
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // Store cleanup function in ref so it can be called on unmount
            cleanupRef.current = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                setIsResizing(false);
            };
        },
        [paneWidth, min, storageKey]
    );

    // Cleanup on unmount if resize is in progress
    useEffect(() => {
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
        };
    }, []);

    return {
        paneWidth,
        isResizing,
        resizeHandleProps: {
            onMouseDown: handleResizeMouseDown
        }
    };
}
