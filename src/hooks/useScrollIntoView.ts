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
 * Custom hook that scrolls an element into view using native scrollIntoView.
 * Simple wrapper that handles timing and only scrolls when needed.
 * 
 * @param elementRef - React ref to the element to scroll into view
 * @param isActive - Whether the element should be scrolled into view
 * @param dependencies - Additional dependencies that should trigger a scroll
 */
export function useScrollIntoView(
    elementRef: RefObject<HTMLElement>,
    isActive: boolean,
    dependencies: any[] = []
) {
    useEffect(() => {
        if (!isActive || !elementRef.current) return;
        
        // Use requestAnimationFrame to ensure DOM is ready
        const frameId = requestAnimationFrame(() => {
            if (elementRef.current && isActive) {
                elementRef.current.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        });
        
        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [isActive, ...dependencies]);
}