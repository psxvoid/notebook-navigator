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

import { TFolder, App } from 'obsidian';

/**
 * Interface for internal plugin structure
 */
interface InternalPlugin {
    enabled: boolean;
    instance?: unknown;
}

/**
 * Interface for app with internal APIs
 */
interface AppWithInternals extends App {
    internalPlugins?: {
        getPluginById?(id: string): InternalPlugin | undefined;
    };
}

/**
 * Safe access to internal Obsidian APIs with type inference
 * Note: internalPlugins is not in Obsidian's public TypeScript API but is widely used
 * This provides safe access to internal plugins (e.g., search, sync) that many community plugins use
 */
export function getInternalPlugin<T = InternalPlugin>(app: App, pluginId: string): T | undefined {
    if (!app || typeof app !== 'object') return undefined;

    const appWithInternals = app as AppWithInternals;
    const plugin = appWithInternals.internalPlugins?.getPluginById?.(pluginId);

    return plugin as T | undefined;
}

/**
 * Interface for app with command APIs
 */
interface AppWithCommands extends App {
    commands?: {
        executeCommandById?(id: string): boolean;
    };
}

/**
 * Safe command execution
 * Note: executeCommandById is not in Obsidian's public TypeScript API but is widely used
 * This is accessing internal Obsidian APIs that many plugins rely on
 */
export function executeCommand(app: App, commandId: string): boolean {
    if (!app || typeof app !== 'object') return false;

    const appWithCommands = app as AppWithCommands;
    try {
        return appWithCommands.commands?.executeCommandById?.(commandId) ?? false;
    } catch {
        return false;
    }
}

/**
 * Check if a folder is an ancestor of another folder
 * @param potentialAncestor - The folder that might be an ancestor
 * @param folder - The folder to check
 * @returns true if potentialAncestor is an ancestor of folder
 */
export function isFolderAncestor(potentialAncestor: TFolder, folder: TFolder): boolean {
    let current = folder.parent;
    while (current) {
        if (current.path === potentialAncestor.path) {
            return true;
        }
        current = current.parent;
    }
    return false;
}
