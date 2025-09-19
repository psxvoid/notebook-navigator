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

import { NotebookNavigatorSettings } from '../settings';

/**
 * Interface for providing access to plugin settings
 * This abstraction allows services to access settings without depending on the concrete plugin class
 */
export interface ISettingsProvider {
    /**
     * Gets the current settings
     * @returns The current plugin settings
     */
    readonly settings: NotebookNavigatorSettings;

    /**
     * Saves the current settings to persistent storage and triggers UI updates
     * @returns Promise that resolves when settings are saved
     */
    saveSettingsAndUpdate(): Promise<void>;

    /**
     * Notifies listeners that settings relevant state changed without persisting
     */
    notifySettingsUpdate(): void;
}
