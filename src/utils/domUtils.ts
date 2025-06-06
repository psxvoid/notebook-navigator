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
import { App, TAbstractFile, TFile, TFolder } from 'obsidian';
import { isTFile, isTFolder } from './typeGuards';

/**
 * Gets the abstract file from a DOM element with a data-path attribute.
 * Searches up the DOM tree to find the nearest element with data-path.
 * 
 * @param element - The DOM element to start searching from
 * @param app - The Obsidian app instance
 * @returns The abstract file if found, null otherwise
 */
export function getAbstractFileFromElement(element: HTMLElement | null, app: App): TAbstractFile | null {
    if (!element) return null;
    
    const path = element.closest('[data-path]')?.getAttribute('data-path');
    return path ? app.vault.getAbstractFileByPath(path) : null;
}

/**
 * Gets a file from a DOM element with a data-path attribute.
 * Searches up the DOM tree to find the nearest element with data-path.
 * 
 * @param element - The DOM element to start searching from
 * @param app - The Obsidian app instance
 * @returns The file if found and is a TFile, null otherwise
 */
export function getFileFromElement(element: HTMLElement | null, app: App): TFile | null {
    const abstractFile = getAbstractFileFromElement(element, app);
    return abstractFile && isTFile(abstractFile) ? abstractFile : null;
}

/**
 * Gets a folder from a DOM element with a data-path attribute.
 * Searches up the DOM tree to find the nearest element with data-path.
 * 
 * @param element - The DOM element to start searching from
 * @param app - The Obsidian app instance
 * @returns The folder if found and is a TFolder, null otherwise
 */
export function getFolderFromElement(element: HTMLElement | null, app: App): TFolder | null {
    const abstractFile = getAbstractFileFromElement(element, app);
    return abstractFile && isTFolder(abstractFile) ? abstractFile : null;
}

/**
 * Gets the path from a DOM element with a data-path attribute.
 * Searches up the DOM tree to find the nearest element with data-path.
 * 
 * @param element - The DOM element to start searching from
 * @returns The path string if found, null otherwise
 */
export function getPathFromElement(element: HTMLElement | null): string | null {
    if (!element) return null;
    return element.closest('[data-path]')?.getAttribute('data-path') ?? null;
}

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