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

import { useEffect, useRef, useState } from 'react';
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
    /** Whether to preserve scroll position when hiding/showing (default: false) */
    preserveScrollOnHide?: boolean;
    /** Direct ref to scroll container - more reliable than virtualizer.scrollElement */
    scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
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
    revealDelay = 0,
    preserveScrollOnHide = false,
    scrollContainerRef
}: UseVisibilityRevealOptions) {
    const [wasVisible, setWasVisible] = useState(isVisible);
    const hasRevealedOnMount = useRef(false);
    const savedScrollOffset = useRef<number | null>(null);
    const hasRestoredScroll = useRef(false);
    
    // Get scroll element - prefer direct ref over virtualizer's element
    const scrollElement = scrollContainerRef?.current || virtualizer?.scrollElement;
    
    // Save scroll position on scroll events while visible
    useEffect(() => {
        if (!preserveScrollOnHide || !scrollElement) return;
        
        // Only track scroll when visible and not in the process of restoring
        if (isVisible && !hasRestoredScroll.current) {
            const handleScroll = () => {
                savedScrollOffset.current = scrollElement.scrollTop;
            };
            
            // Listen to scroll events
            scrollElement.addEventListener('scroll', handleScroll, { passive: true });
            
            return () => {
                scrollElement.removeEventListener('scroll', handleScroll);
            };
        }
    }, [preserveScrollOnHide, scrollElement, isVisible]);
    
    // Reset restoration flag when hiding
    useEffect(() => {
        if (!isVisible) {
            hasRestoredScroll.current = false;
        }
    }, [isVisible]);
    
    
    useEffect(() => {
        // Handle external reveal operations
        if (isRevealOperation && isVisible && virtualizer) {
            const index = getSelectionIndex();
            if (index >= 0) {
                virtualizer.scrollToIndex(index, {
                    align: isMobile ? 'center' : 'auto',
                    behavior: 'auto'
                });
            }
            return;
        }
        
        // Skip if an external reveal operation is in progress
        if (isRevealOperation) {
            return;
        }
        
        // Only reveal when transitioning from hidden to visible
        const isBecomingVisible = isVisible && !wasVisible;
        const shouldRevealOnMount = isVisible && !hasRevealedOnMount.current;
        
        // If we're preserving scroll and becoming visible, restore saved position
        if (preserveScrollOnHide && isBecomingVisible && savedScrollOffset.current !== null && savedScrollOffset.current > 0 && scrollElement) {
            scrollElement.scrollTop = savedScrollOffset.current;
            hasRestoredScroll.current = true;
            // Don't clear the saved position yet - we might need it if restoration fails
            // Don't reveal selection when restoring scroll
            return;
        }
        
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
    }, [isVisible, getSelectionIndex, virtualizer, isMobile, revealDelay, isRevealOperation, preserveScrollOnHide, scrollElement, wasVisible]);
    
    // Update visibility state after effects run
    useEffect(() => {
        setWasVisible(isVisible);
    }, [isVisible]);
}