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

/**
 * Debounce function that executes immediately on first call (leading edge)
 * and then debounces subsequent calls.
 *
 * This is different from standard debounce which waits before first execution.
 * Use this when you want immediate UI feedback on the first user action.
 *
 * @param func Function to debounce
 * @param wait Milliseconds to wait between executions
 * @returns Debounced function with leading edge execution
 */
export function leadingEdgeDebounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout | null = null;
    let lastCallTime = 0;

    return ((...args: Parameters<T>) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;

        // Execute immediately if first call or enough time passed
        if (!timeout || timeSinceLastCall > wait) {
            func(...args);
            lastCallTime = now;
        }

        // Clear existing timeout
        if (timeout) clearTimeout(timeout);

        // Set new timeout for trailing execution
        timeout = setTimeout(() => {
            const currentTime = Date.now();
            if (currentTime - lastCallTime >= wait) {
                func(...args);
                lastCallTime = currentTime;
            }
        }, wait);
    }) as T;
}
