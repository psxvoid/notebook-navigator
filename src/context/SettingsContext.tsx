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

// Extended settings type that includes recent data from local storage
type SettingsSnapshot = NotebookNavigatorSettings & {
    recentNotes: string[];
    recentIcons: Record<string, string[]>;
};

// Separate contexts for state and update function
const SettingsStateContext = createContext<SettingsSnapshot | null>(null);
const SettingsUpdateContext = createContext<((updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>) | null>(null);

interface SettingsProviderProps {
    children: ReactNode;
    plugin: NotebookNavigatorPlugin;
}

export function SettingsProvider({ children, plugin }: SettingsProviderProps) {
    // Use a version counter to force re-renders when settings change
    const [version, setVersion] = useState(0);
    const [recentVersion, setRecentVersion] = useState(0);

    const updateSettings = useCallback(
        async (updater: (settings: NotebookNavigatorSettings) => void) => {
            // Update the settings object
            updater(plugin.settings);

            // Save to storage
            await plugin.saveSettingsAndUpdate();

            // The listener registered in useEffect will handle the re-render
            // by incrementing the version when onSettingsUpdate is called
        },
        [plugin]
    );

    // Create a stable settings object that changes reference when version changes
    // This ensures components using SettingsStateContext re-render when settings change
    const settingsValue: SettingsSnapshot = React.useMemo(() => {
        // Track version changes to force re-computation
        void version;
        void recentVersion;
        // Create snapshot with settings and recent data
        const snapshot = { ...plugin.settings } as SettingsSnapshot;
        snapshot.recentNotes = plugin.getRecentNotes();
        snapshot.recentIcons = plugin.getRecentIcons();
        return snapshot;
    }, [plugin, version, recentVersion]);

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

    // Listen for recent data updates from the plugin
    useEffect(() => {
        const id = `settings-provider-recent-${Date.now()}`;

        // Increment version counter when recent data changes
        const handleRecentUpdate = () => {
            setRecentVersion(v => v + 1);
        };

        plugin.registerRecentDataListener(id, handleRecentUpdate);

        return () => {
            plugin.unregisterRecentDataListener(id);
        };
    }, [plugin]);

    return (
        <SettingsStateContext.Provider value={settingsValue}>
            <SettingsUpdateContext.Provider value={updateSettings}>{children}</SettingsUpdateContext.Provider>
        </SettingsStateContext.Provider>
    );
}

// Hook to get only settings state (use this when you only need to read settings)
export function useSettingsState(): SettingsSnapshot {
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
