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

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import NotebookNavigatorPlugin from '../main';
import { NotebookNavigatorSettings } from '../settings';

// Separate contexts for state and update function
const SettingsStateContext = createContext<NotebookNavigatorSettings | null>(null);
const SettingsUpdateContext = createContext<((updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>) | null>(null);

interface SettingsProviderProps {
    children: ReactNode;
    plugin: NotebookNavigatorPlugin;
}

export function SettingsProvider({ children, plugin }: SettingsProviderProps) {
    // Use a version counter to force re-renders when settings change
    const [version, setVersion] = useState(0);

    const updateSettings = useCallback(
        async (updater: (settings: NotebookNavigatorSettings) => void) => {
            // Update the settings object
            updater(plugin.settings);

            // Save to storage
            await plugin.saveSettings();

            // The listener registered in useEffect will handle the re-render
            // by incrementing the version when onSettingsUpdate is called
        },
        [plugin]
    );

    // Create a stable settings object that changes reference when version changes
    // This ensures components using SettingsStateContext re-render when settings change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const settingsValue = React.useMemo(() => ({ ...plugin.settings }), [version]);
    // We intentionally use 'version' instead of 'plugin.settings' as the dependency because:
    // 1. plugin.settings is mutated in place by the updater function (line 39)
    // 2. Its reference never changes, so including it would never trigger re-computation
    // 3. 'version' is incremented whenever settings change, forcing a new object creation

    // Listen for settings updates from the plugin (e.g., from settings tab)
    useEffect(() => {
        const id = `settings-provider-${Date.now()}`;

        const handleSettingsUpdate = () => {
            // Force re-render by incrementing version
            setVersion(v => v + 1);
        };

        plugin.registerSettingsUpdateListener(id, handleSettingsUpdate);

        return () => {
            plugin.unregisterSettingsUpdateListener(id);
        };
    }, [plugin]);

    return (
        <SettingsStateContext.Provider value={settingsValue}>
            <SettingsUpdateContext.Provider value={updateSettings}>{children}</SettingsUpdateContext.Provider>
        </SettingsStateContext.Provider>
    );
}

// Hook to get only settings state (use this when you only need to read settings)
export function useSettingsState() {
    const context = useContext(SettingsStateContext);
    if (context === null) {
        throw new Error('useSettingsState must be used within a SettingsProvider');
    }
    return context;
}

// Hook to get only the update function (use this when you only need to update settings)
export function useSettingsUpdate() {
    const context = useContext(SettingsUpdateContext);
    if (!context) {
        throw new Error('useSettingsUpdate must be used within a SettingsProvider');
    }
    return context;
}
