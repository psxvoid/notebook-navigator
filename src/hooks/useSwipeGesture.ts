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

interface UseSwipeGestureOptions {
    onSwipeRight?: () => void;
    onSwipeLeft?: () => void;
    threshold?: number;
    edgeThreshold?: number;
    enabled?: boolean;
}

/**
 * Custom hook for detecting swipe gestures on touch devices.
 * Useful for implementing mobile navigation patterns.
 * Supports edge swipes for iOS-like navigation.
 */
export function useSwipeGesture(
    containerRef: React.RefObject<HTMLElement | null>,
    options: UseSwipeGestureOptions
) {
    const { 
        onSwipeRight, 
        onSwipeLeft, 
        threshold = 50,
        edgeThreshold = 25, // Start swipe must be within this many pixels of edge (iOS uses ~20-25px)
        enabled = true 
    } = options;
    
    // Check if RTL mode is active
    const isRTL = document.body.classList.contains('mod-rtl');
    
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const isValidSwipe = useRef<boolean>(false);
    
    useEffect(() => {
        if (!enabled || !containerRef.current) return;
        
        const container = containerRef.current;
        
        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            touchStartX.current = touch.clientX;
            touchStartY.current = touch.clientY;
            
            // Check if touch started near the edge for edge swipe
            // In RTL mode, check right edge; in LTR mode, check left edge
            if (isRTL) {
                isValidSwipe.current = touch.clientX >= (window.innerWidth - edgeThreshold);
            } else {
                isValidSwipe.current = touch.clientX <= edgeThreshold;
            }
        };
        
        const handleTouchMove = (e: TouchEvent) => {
            // For edge swipes, we might want to prevent default scrolling
            if (isValidSwipe.current && touchStartX.current !== null) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - touchStartX.current;
                
                // Prevent vertical scroll when swiping from edge
                // In RTL: swiping left from right edge; in LTR: swiping right from left edge
                if ((isRTL && deltaX < -10) || (!isRTL && deltaX > 10)) {
                    e.preventDefault();
                }
            }
        };
        
        const handleTouchEnd = (e: TouchEvent) => {
            if (touchStartX.current === null || touchStartY.current === null) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX.current;
            const deltaY = touchEndY - touchStartY.current;
            
            // Check if horizontal swipe is more significant than vertical
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
                if (deltaX > 0 && onSwipeRight) {
                    // For right swipe, check if it started from correct edge based on RTL
                    const isEdgeSwipe = isRTL ? 
                        (touchStartX.current >= (window.innerWidth - edgeThreshold)) : 
                        (touchStartX.current <= edgeThreshold);
                    
                    if (isValidSwipe.current || isEdgeSwipe) {
                        onSwipeRight();
                    }
                } else if (deltaX < 0 && onSwipeLeft) {
                    // For left swipe, check if it started from correct edge based on RTL
                    const isEdgeSwipe = isRTL ? 
                        (touchStartX.current <= edgeThreshold) : 
                        (touchStartX.current >= (window.innerWidth - edgeThreshold));
                    
                    if (isValidSwipe.current || isEdgeSwipe) {
                        onSwipeLeft();
                    }
                }
            }
            
            touchStartX.current = null;
            touchStartY.current = null;
            isValidSwipe.current = false;
        };
        
        container.addEventListener('touchstart', handleTouchStart);
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        
        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [containerRef, onSwipeRight, onSwipeLeft, threshold, edgeThreshold, enabled, isRTL]);
}