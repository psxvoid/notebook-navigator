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

import type { App, Setting } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';

/**
 * Factory function type for creating debounced text settings
 * Prevents excessive updates while user is typing
 */
export type DebouncedTextSettingFactory = (
    container: HTMLElement,
    name: string,
    desc: string,
    placeholder: string,
    getValue: () => string,
    setValue: (value: string) => void,
    validator?: (value: string) => boolean,
    onAfterUpdate?: () => void
) => Setting;

/**
 * Context object passed to settings tab render functions
 * Provides access to app, plugin, and utility methods for tab rendering
 */
export interface SettingsTabContext {
    app: App;
    plugin: NotebookNavigatorPlugin;
    containerEl: HTMLElement;
    createDebouncedTextSetting: DebouncedTextSettingFactory;
    /** Registers the element where metadata info should be displayed */
    registerMetadataInfoElement(element: HTMLElement): void;
    /** Registers the element where statistics should be displayed */
    registerStatsTextElement(element: HTMLElement): void;
    /** Requests an immediate statistics refresh */
    requestStatisticsRefresh(): void;
    /** Ensures the statistics update interval is running */
    ensureStatisticsInterval(): void;
    /** Registers a listener for show tags visibility changes */
    registerShowTagsListener(listener: (visible: boolean) => void): void;
    /** Notifies all listeners of show tags visibility change */
    notifyShowTagsVisibility(visible: boolean): void;
}
