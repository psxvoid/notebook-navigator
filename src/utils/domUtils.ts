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

// src/utils/domUtils.ts


/**
 * Gets the path from a DOM element with a specific data attribute.
 * Useful for drag and drop operations that use different data attributes.
 * 
 * @param element - The DOM element to check
 * @param attribute - The data attribute name (e.g., 'data-drag-path')
 * @returns The path string if found, null otherwise
 */
export function getPathFromDataAttribute(element: HTMLElement | null, attribute: string): string | null {
    return element?.getAttribute(attribute) ?? null;
}

/**
 * Checks if the user is currently typing in an input field.
 * Used to prevent keyboard shortcuts from firing while typing.
 * 
 * @param e - The keyboard event
 * @returns True if typing in an input field, false otherwise
 */
export function isTypingInInput(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement;
    return target.tagName === 'INPUT' || 
           target.tagName === 'TEXTAREA' || 
           target.contentEditable === 'true';
}