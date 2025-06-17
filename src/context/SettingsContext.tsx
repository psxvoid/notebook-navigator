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
import { NotebookNavigatorSettings } from '../settings';
import NotebookNavigatorPlugin from '../main';

interface SettingsContextType {
    settings: NotebookNavigatorSettings;
    updateSettings: (updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

interface SettingsProviderProps {
    children: ReactNode;
    plugin: NotebookNavigatorPlugin;
}

export function SettingsProvider({ children, plugin }: SettingsProviderProps) {
    // Use a version counter to force re-renders when settings change
    const [version, setVersion] = useState(0);
    
    // Get the current settings from the plugin
    const settings = plugin.settings;
    
    const updateSettings = useCallback(async (updater: (settings: NotebookNavigatorSettings) => void) => {
        // Update the settings object
        updater(plugin.settings);
        
        // Save to storage
        await plugin.saveSettings();
        
        // Increment version to trigger re-renders
        setVersion(v => v + 1);
    }, [plugin]);
    
    
    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}