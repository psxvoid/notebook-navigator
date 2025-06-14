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
 */
export function scrollVirtualItemIntoView(
    virtualizer: Virtualizer<any, any>,
    index: number,
    behavior: 'auto' | 'smooth' = 'auto'
) {
    if (index < 0 || !virtualizer) return;
    
    // Use setTimeout to ensure virtualizer has measured items
    // This is more reliable than double RAF for virtualized lists
    const timeoutId = setTimeout(() => {
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
            
            virtualizer.scrollToIndex(index, {
                align: 'center',
                behavior
            });
        } catch (error) {
            // Fail silently if virtualizer is not ready
            console.debug('Failed to scroll to virtual item:', error);
        }
    }, 0);
    
    // Return cleanup function
    return () => clearTimeout(timeoutId);
}