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

import { useEffect } from 'react';
import { useServices } from '../context/ServicesContext';
import { useSettingsUpdate } from '../context/SettingsContext';

/**
 * Hook that bridges the gap between main.ts vault events and React UI updates.
 * Registers a callback with the plugin that triggers a settings version increment
 * when metadata changes occur from outside the React UI (e.g., file renames).
 * 
 * This ensures the UI stays in sync with metadata changes without imperative refresh() calls.
 */
export function useMetadataSync() {
    const { plugin } = useServices();
    const updateSettings = useSettingsUpdate();
    
    useEffect(() => {
        // Generate a unique ID for this listener
        const id = `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Callback that will be triggered by main.ts when metadata changes
        const handleMetadataUpdate = () => {
            // A "no-op" update that simply increments the version in SettingsContext,
            // forcing a clean, reactive re-render of all components using settings
            updateSettings(settings => {
                // No actual changes to settings, just trigger re-render
            });
        };
        
        // Register the callback with the plugin
        plugin.registerSettingsUpdateListener(id, handleMetadataUpdate);
        
        // Cleanup: unregister when the component unmounts
        return () => {
            plugin.unregisterSettingsUpdateListener(id);
        };
    }, [plugin, updateSettings]);
}