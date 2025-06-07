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

import { useEffect, RefObject } from 'react';

/**
 * Custom hook that scrolls an element into view within a scrollable container.
 * Uses manual scroll calculation for more reliable behavior than native scrollIntoView.
 * 
 * @param elementRef - React ref to the element to scroll into view
 * @param containerSelector - CSS selector for the scrollable container
 * @param isActive - Whether the element should be scrolled into view
 * @param dependencies - Additional dependencies that should trigger a scroll
 */
export function useScrollIntoView(
    elementRef: RefObject<HTMLElement>,
    containerSelector: string,
    isActive: boolean,
    dependencies: any[] = []
) {
    useEffect(() => {
        if (!isActive || !elementRef.current) return;
        
        let animationFrameId: number;
        let secondFrameId: number;
        
        const scrollIntoViewIfNeeded = () => {
            if (!elementRef.current || !isActive) return;
            
            const scrollContainer = elementRef.current.closest(containerSelector) as HTMLElement;
            if (!scrollContainer) return;
            
            const containerRect = scrollContainer.getBoundingClientRect();
            const itemRect = elementRef.current.getBoundingClientRect();
            
            // Check if item is outside visible area
            const isOutsideView = itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom;
            
            if (isOutsideView) {
                // Calculate scroll position to center the item
                const scrollTop = scrollContainer.scrollTop;
                const itemOffsetTop = itemRect.top - containerRect.top + scrollTop;
                const itemHeight = itemRect.height;
                const containerHeight = containerRect.height;
                
                // Center the item in the container
                const targetScrollTop = itemOffsetTop - (containerHeight / 2) + (itemHeight / 2);
                
                scrollContainer.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth'
                });
            }
        };
        
        // Use double RAF for proper timing after DOM updates
        animationFrameId = requestAnimationFrame(() => {
            secondFrameId = requestAnimationFrame(scrollIntoViewIfNeeded);
        });
        
        // Cleanup
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (secondFrameId) cancelAnimationFrame(secondFrameId);
        };
    }, [isActive, containerSelector, ...dependencies]);
}