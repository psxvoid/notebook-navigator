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
 * Type-safe localStorage wrapper with JSON serialization
 * Provides a cleaner API with methods instead of standalone functions
 */
export const localStorage = {
    /**
     * Safely retrieves a value from localStorage with error handling
     * Always attempts JSON parsing
     * @param key - The localStorage key
     * @returns The parsed value or null if not found/error occurs
     */
    get<T = string>(key: string): T | null {
        try {
            const item = window.localStorage.getItem(key);
            if (!item) return null;
            
            // Always parse as JSON - all our data is stored as JSON
            return JSON.parse(item) as T;
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
            const stringified = JSON.stringify(value);
            window.localStorage.setItem(key, stringified);
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
            window.localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Failed to remove from localStorage for key "${key}":`, error);
            return false;
        }
    }
};