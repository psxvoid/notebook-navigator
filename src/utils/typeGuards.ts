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

import { TFile, TFolder, TAbstractFile } from 'obsidian';

/**
 * Type guard to check if an object is a TFile
 */
export function isTFile(obj: unknown): obj is TFile {
    return obj !== null && 
           typeof obj === 'object' &&
           'vault' in obj &&
           'path' in obj &&
           'extension' in obj &&
           !('children' in obj); // TFolder has children, TFile doesn't
}

/**
 * Type guard to check if an object is a TFolder
 */
export function isTFolder(obj: unknown): obj is TFolder {
    return obj !== null && 
           typeof obj === 'object' &&
           'vault' in obj &&
           'path' in obj &&
           'children' in obj &&
           Array.isArray((obj as any).children);
}

/**
 * Safe cast to TFile with validation
 */
export function asTFile(obj: unknown): TFile {
    if (!isTFile(obj)) {
        const typeName = obj && typeof obj === 'object' && 'constructor' in obj 
            ? (obj as any).constructor.name 
            : typeof obj;
        throw new TypeError(`Expected TFile but got ${typeName}`);
    }
    return obj;
}

/**
 * Safe cast to TFolder with validation
 */
export function asTFolder(obj: unknown): TFolder {
    if (!isTFolder(obj)) {
        const typeName = obj && typeof obj === 'object' && 'constructor' in obj 
            ? (obj as any).constructor.name 
            : typeof obj;
        throw new TypeError(`Expected TFolder but got ${typeName}`);
    }
    return obj;
}

/**
 * Safe access to internal Obsidian APIs with type inference
 */
export function getInternalPlugin<T = any>(app: any, pluginId: string): T | undefined {
    return app.internalPlugins?.getPluginById?.(pluginId);
}

/**
 * Safe command execution
 */
export function executeCommand(app: any, commandId: string): boolean {
    try {
        return app.commands?.executeCommandById?.(commandId) ?? false;
    } catch {
        return false;
    }
}

/**
 * Assert non-null with descriptive error
 */
export function assertNonNull<T>(value: T | null | undefined, message: string): asserts value is T {
    if (value === null || value === undefined) {
        throw new Error(message);
    }
}