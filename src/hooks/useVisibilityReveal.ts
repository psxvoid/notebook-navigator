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
import { Virtualizer } from '@tanstack/react-virtual';

interface UseVisibilityRevealOptions {
    /** Function to get the index of the current selection */
    getSelectionIndex: () => number;
    /** The virtualizer instance */
    virtualizer: Virtualizer<HTMLDivElement, Element> | null;
    /** Whether the component is visible */
    isVisible: boolean;
    /** Whether this is mobile (affects alignment) */
    isMobile: boolean;
    /** Whether a reveal operation is in progress (from external source) */
    isRevealOperation?: boolean;
    /** Optional delay before revealing (default: 0) */
    revealDelay?: number;
}

/**
 * Hook that reveals the current selection when a component becomes visible.
 * This consolidates reveal logic and ensures we only scroll when transitioning
 * from hidden to visible state.
 */
export function useVisibilityReveal({
    getSelectionIndex,
    virtualizer,
    isVisible,
    isMobile,
    isRevealOperation = false,
    revealDelay = 0
}: UseVisibilityRevealOptions) {
    const wasVisible = useRef(isVisible);
    const hasRevealedOnMount = useRef(false);
    
    useEffect(() => {
        // Skip if an external reveal operation is in progress
        if (isRevealOperation) return;
        
        // Only reveal when transitioning from hidden to visible
        const isBecomingVisible = isVisible && !wasVisible.current;
        const shouldRevealOnMount = isVisible && !hasRevealedOnMount.current;
        
        if ((isBecomingVisible || shouldRevealOnMount) && virtualizer) {
            const index = getSelectionIndex();
            
            if (index >= 0) {
                const reveal = () => {
                    virtualizer.scrollToIndex(index, {
                        align: isMobile ? 'center' : 'auto',
                        behavior: 'auto' // Instant scroll
                    });
                };
                
                if (revealDelay > 0) {
                    const timeout = setTimeout(reveal, revealDelay);
                    return () => clearTimeout(timeout);
                } else {
                    reveal();
                }
            }
            
            if (!hasRevealedOnMount.current) {
                hasRevealedOnMount.current = true;
            }
        }
        
        // Update visibility tracking
        wasVisible.current = isVisible;
    }, [isVisible, getSelectionIndex, virtualizer, isMobile, revealDelay, isRevealOperation]);
}