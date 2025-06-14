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

import { Virtualizer } from '@tanstack/react-virtual';

/**
 * Scrolls a virtual item into view with proper timing
 * Uses setTimeout with 0 delay to ensure DOM updates are processed
 * 
 * @param virtualizer - The TanStack virtualizer instance
 * @param index - The index of the item to scroll to
 * @param behavior - The scroll behavior ('auto' or 'smooth')
 * @param scrollToHeader - If true, scrolls to show the group header above the item
 */
export function scrollVirtualItemIntoView(
    virtualizer: Virtualizer<any, any>,
    index: number,
    behavior: 'auto' | 'smooth' = 'auto',
    maxRetries: number = 3,
    scrollToHeader: boolean = false
) {
    if (index < 0 || !virtualizer) return () => {};
    
    let retryCount = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const attemptScroll = () => {
        try {
            // Check if virtualizer is still valid and not disposed
            if (!virtualizer || 
                typeof virtualizer !== 'object' ||
                !virtualizer.scrollToIndex || 
                typeof virtualizer.scrollToIndex !== 'function') {
                return;
            }
            
            // Additional safety check for valid index
            if (index < 0 || index >= (virtualizer.options?.count ?? 0)) {
                return;
            }
            
            // When scrollToHeader is true and we're not at the first item,
            // scroll to show the group header if it exists
            const targetIndex = (scrollToHeader && index > 0) ? index - 1 : index;
            
            virtualizer.scrollToIndex(targetIndex, {
                align: scrollToHeader ? 'start' : 'auto',
                behavior
            });
        } catch (error) {
            // Retry if we haven't exceeded max retries
            if (retryCount < maxRetries) {
                retryCount++;
                console.debug(`Retrying scroll to virtual item (attempt ${retryCount}/${maxRetries}):`, error);
                timeoutId = setTimeout(attemptScroll, 50 * retryCount);
            } else {
                console.debug('Failed to scroll to virtual item after max retries:', error);
            }
        }
    };
    
    // Use setTimeout to ensure virtualizer has measured items
    // This is more reliable than double RAF for virtualized lists
    timeoutId = setTimeout(attemptScroll, 0);
    
    // Return cleanup function
    return () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    };
}