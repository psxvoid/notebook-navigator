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

import { App } from 'obsidian';

// Current localStorage schema version
export const LOCALSTORAGE_VERSION = 1;

/**
 * Type-safe localStorage wrapper with JSON serialization
 * Uses Obsidian's vault-specific localStorage methods to ensure data isolation between vaults
 * IMPORTANT: Must be initialized with app instance before use to prevent data mixing
 */
export const localStorage = {
    _app: null as App | null,

    /**
     * Initialize the localStorage utility with the app instance
     * This enables vault-specific storage isolation
     */
    init(app: App) {
        this._app = app;
    },
    /**
     * Safely retrieves a value from localStorage with error handling
     * Always attempts JSON parsing
     * @param key - The localStorage key
     * @returns The parsed value or null if not found/error occurs
     */
    get<T = string>(key: string): T | null {
        try {
            if (!this._app) {
                // Return null if app not initialized to prevent mixing storage
                console.warn(`localStorage accessed before initialization for key "${key}"`);
                return null;
            }
            // Use vault-specific storage
            const data = this._app.loadLocalStorage(key);
            return data as T;
        } catch (error) {
            console.error(`Failed to get from localStorage for key "${key}":`, error);
            return null;
        }
    },

    /**
     * Safely sets a value in localStorage with error handling
     * @param key - The localStorage key
     * @param value - The value to store (will be JSON stringified)
     * @returns True if successful, false otherwise
     */
    set<T>(key: string, value: T): boolean {
        try {
            if (!this._app) {
                // Ignore writes if app not initialized to prevent mixing storage
                console.warn(`localStorage write attempted before initialization for key "${key}"`);
                return false;
            }
            // Use vault-specific storage
            this._app.saveLocalStorage(key, value);
            return true;
        } catch (error) {
            console.error(`Failed to set localStorage for key "${key}":`, error);
            return false;
        }
    },

    /**
     * Safely removes a value from localStorage with error handling
     * @param key - The localStorage key
     * @returns True if successful, false otherwise
     */
    remove(key: string): boolean {
        try {
            if (!this._app) {
                // Ignore removes if app not initialized to prevent mixing storage
                console.warn(`localStorage remove attempted before initialization for key "${key}"`);
                return false;
            }
            // Use vault-specific storage - pass null to clear
            this._app.saveLocalStorage(key, null);
            return true;
        } catch (error) {
            console.error(`Failed to remove from localStorage for key "${key}":`, error);
            return false;
        }
    }
};
