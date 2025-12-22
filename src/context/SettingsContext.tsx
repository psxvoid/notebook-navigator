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

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import NotebookNavigatorPlugin from '../main';
import { NotebookNavigatorSettings } from '../settings';
import type { DualPaneOrientation, PinnedNotes } from '../types';
import type { VaultProfile } from '../settings/types';
import type { FileVisibility } from '../utils/fileTypeUtils';
import type { ShortcutEntry } from '../types/shortcuts';
import { isFolderShortcut, isNoteShortcut, isSearchShortcut, isTagShortcut } from '../types/shortcuts';
import { cloneShortcuts, getActiveVaultProfile } from '../utils/vaultProfiles';
import { sanitizeRecord } from '../utils/recordUtils';
import { areStringArraysEqual } from '../utils/arrayUtils';
import type { FolderAppearance } from '../hooks/useListPaneAppearance';
import { buildFileNameIconNeedles, type FileNameIconNeedle } from '../utils/fileIconUtils';

// Separate contexts for state and update function
type SettingsStateValue = NotebookNavigatorSettings & { dualPaneOrientation: DualPaneOrientation };
export interface ActiveProfileState {
    profile: VaultProfile;
    hiddenFolders: string[];
    hiddenFiles: string[];
    hiddenFileNamePatterns: string[];
    hiddenTags: string[];
    fileVisibility: FileVisibility;
    navigationBanner: string | null;
}

const SettingsStateContext = createContext<SettingsStateValue | null>(null);
const SettingsUpdateContext = createContext<((updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>) | null>(null);
const ActiveProfileContext = createContext<ActiveProfileState | null>(null);
interface SettingsDerivedValue {
    fileNameIconNeedles: readonly FileNameIconNeedle[];
}
const SettingsDerivedContext = createContext<SettingsDerivedValue | null>(null);

// Compares shortcut lists to reuse the previous profile object when entries are unchanged.
const areShortcutsEqual = (prev?: ShortcutEntry[] | null, next?: ShortcutEntry[] | null): boolean => {
    if (prev === next) {
        return true;
    }
    const prevList = Array.isArray(prev) ? prev : [];
    const nextList = Array.isArray(next) ? next : [];
    if (prevList.length !== nextList.length) {
        return false;
    }

    for (let index = 0; index < prevList.length; index += 1) {
        const prevShortcut = prevList[index];
        const nextShortcut = nextList[index];

        if (prevShortcut.type !== nextShortcut.type) {
            return false;
        }

        if (isFolderShortcut(prevShortcut)) {
            if (!isFolderShortcut(nextShortcut) || prevShortcut.path !== nextShortcut.path) {
                return false;
            }
            continue;
        }

        if (isNoteShortcut(prevShortcut)) {
            if (!isNoteShortcut(nextShortcut) || prevShortcut.path !== nextShortcut.path) {
                return false;
            }
            continue;
        }

        if (isTagShortcut(prevShortcut)) {
            if (!isTagShortcut(nextShortcut) || prevShortcut.tagPath !== nextShortcut.tagPath) {
                return false;
            }
            continue;
        }

        if (!isSearchShortcut(prevShortcut) || !isSearchShortcut(nextShortcut)) {
            return false;
        }
        if (
            prevShortcut.name !== nextShortcut.name ||
            prevShortcut.query !== nextShortcut.query ||
            prevShortcut.provider !== nextShortcut.provider
        ) {
            return false;
        }
    }

    return true;
};

const cloneAppearanceMap = <T extends FolderAppearance>(map?: Record<string, T>): Record<string, T> => {
    if (!map) {
        return Object.create(null) as Record<string, T>;
    }
    const cloned = Object.create(null) as Record<string, T>;
    Object.entries(map).forEach(([key, value]) => {
        cloned[key] = { ...value };
    });
    return cloned;
};

const clonePinnedNotes = (pinnedNotes?: PinnedNotes): PinnedNotes => {
    if (!pinnedNotes) {
        return {} as PinnedNotes;
    }
    const cloned = Object.create(null) as PinnedNotes;
    Object.entries(pinnedNotes).forEach(([path, contexts]) => {
        cloned[path] = { ...contexts };
    });
    return cloned;
};

interface SettingsProviderProps {
    children: ReactNode;
    plugin: NotebookNavigatorPlugin;
}

export function SettingsProvider({ children, plugin }: SettingsProviderProps) {
    // Use a version counter to force re-renders when settings change
    const [version, setVersion] = useState(0);
    const previousActiveProfileRef = useRef<ActiveProfileState | null>(null);

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
    // NOTE: settings are mutated in place; the version counter forces object recreation
    const settingsValue = React.useMemo<SettingsStateValue>(() => {
        // Clone tag color records so settings updates change object identity and trigger consumers
        const tagColors = sanitizeRecord(plugin.settings.tagColors);
        const tagBackgroundColors = sanitizeRecord(plugin.settings.tagBackgroundColors);
        const nextSettings: SettingsStateValue = {
            ...plugin.settings,
            dualPaneOrientation: plugin.getDualPaneOrientation(),
            tagColors,
            tagBackgroundColors,
            folderAppearances: cloneAppearanceMap(plugin.settings.folderAppearances),
            tagAppearances: cloneAppearanceMap(plugin.settings.tagAppearances),
            pinnedNotes: clonePinnedNotes(plugin.settings.pinnedNotes)
        };
        // Deep copy vault profiles to prevent mutations from affecting the original settings
        if (Array.isArray(plugin.settings.vaultProfiles)) {
            // Create deep copies of profile arrays to prevent shared references
            nextSettings.vaultProfiles = plugin.settings.vaultProfiles.map(profile => ({
                ...profile,
                hiddenFolders: Array.isArray(profile.hiddenFolders) ? [...profile.hiddenFolders] : [],
                hiddenFiles: Array.isArray(profile.hiddenFiles) ? [...profile.hiddenFiles] : [],
                hiddenFileNamePatterns: Array.isArray(profile.hiddenFileNamePatterns) ? [...profile.hiddenFileNamePatterns] : [],
                hiddenTags: Array.isArray(profile.hiddenTags) ? [...profile.hiddenTags] : [],
                shortcuts: cloneShortcuts(profile.shortcuts)
            }));
        }
        void version; // Keep dependency so settings snapshot recreates when updates are published
        return nextSettings;
    }, [plugin, version]);

    const derivedValue = React.useMemo<SettingsDerivedValue>(() => {
        const fileNameIconNeedles = settingsValue.showFilenameMatchIcons ? buildFileNameIconNeedles(settingsValue.fileNameIconMap) : [];
        return { fileNameIconNeedles };
    }, [settingsValue.showFilenameMatchIcons, settingsValue.fileNameIconMap]);

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

    // Memoize the active profile snapshot and reuse the previous object when nothing changed.
    const activeProfileValue = React.useMemo<ActiveProfileState>(() => {
        const profile = getActiveVaultProfile(settingsValue);
        const previous = previousActiveProfileRef.current;
        const isSameProfile = previous?.profile.id === profile.id;

        const hiddenFoldersEqual = areStringArraysEqual(previous?.profile.hiddenFolders ?? [], profile.hiddenFolders);
        const hiddenFilesEqual = areStringArraysEqual(previous?.profile.hiddenFiles ?? [], profile.hiddenFiles);
        const hiddenFileNamePatternsEqual = areStringArraysEqual(
            previous?.profile.hiddenFileNamePatterns ?? [],
            profile.hiddenFileNamePatterns
        );
        const hiddenTagsEqual = areStringArraysEqual(previous?.profile.hiddenTags ?? [], profile.hiddenTags);
        const fileVisibilityEqual = previous?.profile.fileVisibility === profile.fileVisibility;
        const navigationBanner = profile.navigationBanner ?? null;
        const navigationBannerEqual = previous?.navigationBanner === navigationBanner;
        const nameEqual = previous?.profile.name === profile.name;
        const shortcutsEqual = areShortcutsEqual(previous?.profile.shortcuts, profile.shortcuts);

        if (
            isSameProfile &&
            hiddenFoldersEqual &&
            hiddenFilesEqual &&
            hiddenFileNamePatternsEqual &&
            hiddenTagsEqual &&
            fileVisibilityEqual &&
            navigationBannerEqual &&
            nameEqual &&
            shortcutsEqual &&
            previous
        ) {
            return previous;
        }

        const nextActiveProfile: ActiveProfileState = {
            profile,
            hiddenFolders: profile.hiddenFolders,
            hiddenFiles: profile.hiddenFiles,
            hiddenFileNamePatterns: profile.hiddenFileNamePatterns,
            hiddenTags: profile.hiddenTags,
            fileVisibility: profile.fileVisibility,
            navigationBanner
        };

        previousActiveProfileRef.current = nextActiveProfile;
        return nextActiveProfile;
    }, [settingsValue]);

    return (
        <SettingsStateContext.Provider value={settingsValue}>
            <SettingsDerivedContext.Provider value={derivedValue}>
                <ActiveProfileContext.Provider value={activeProfileValue}>
                    <SettingsUpdateContext.Provider value={updateSettings}>{children}</SettingsUpdateContext.Provider>
                </ActiveProfileContext.Provider>
            </SettingsDerivedContext.Provider>
        </SettingsStateContext.Provider>
    );
}

// Hook to get only settings state (use this when you only need to read settings)
export function useSettingsState(): SettingsStateValue {
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

export function useSettingsDerived(): SettingsDerivedValue {
    const context = useContext(SettingsDerivedContext);
    if (!context) {
        throw new Error('useSettingsDerived must be used within a SettingsProvider');
    }
    return context;
}

export function useActiveProfile(): ActiveProfileState {
    const context = useContext(ActiveProfileContext);
    if (!context) {
        throw new Error('useActiveProfile must be used within a SettingsProvider');
    }
    return context;
}
