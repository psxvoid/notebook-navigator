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

import type { NotebookNavigatorSettings } from '../settings';
import type { VaultProfile } from '../settings/types';
import { strings } from '../i18n';
import { FILE_VISIBILITY, type FileVisibility } from './fileTypeUtils';

export const DEFAULT_VAULT_PROFILE_ID = 'default';
const FALLBACK_VAULT_PROFILE_NAME = 'Default';

interface VaultProfileInitOptions {
    id?: string;
    hiddenFolders?: string[];
    hiddenFiles?: string[];
    hiddenTags?: string[];
    fileVisibility?: FileVisibility;
    navigationBanner?: string | null;
}

// Creates a clean copy of pattern array, trimming and filtering out empty strings
const clonePatterns = (patterns: string[] | undefined): string[] => {
    if (!Array.isArray(patterns)) {
        return [];
    }
    return patterns.map(pattern => pattern.trim()).filter(pattern => pattern.length > 0);
};

// Generates a unique profile ID using timestamp and random string
const generateProfileId = (): string => {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

// Returns the profile name or falls back to the localized default name if empty
const resolveProfileName = (name: string | undefined): string => {
    const trimmed = (name ?? '').trim();
    if (trimmed.length > 0) {
        return trimmed;
    }
    return getLocalizedDefaultVaultProfileName();
};

// Validates and returns a file visibility setting, defaulting to SUPPORTED if invalid
const resolveFileVisibility = (value: FileVisibility | undefined): FileVisibility => {
    if (value === FILE_VISIBILITY.ALL || value === FILE_VISIBILITY.DOCUMENTS || value === FILE_VISIBILITY.SUPPORTED) {
        return value;
    }
    return FILE_VISIBILITY.SUPPORTED;
};

// Creates a new vault profile with the specified name and configuration options
export function createVaultProfile(name: string, options: VaultProfileInitOptions = {}): VaultProfile {
    return {
        id: options.id ?? generateProfileId(),
        name: resolveProfileName(name),
        fileVisibility: resolveFileVisibility(options.fileVisibility),
        hiddenFolders: clonePatterns(options.hiddenFolders),
        hiddenTags: clonePatterns(options.hiddenTags),
        hiddenFiles: clonePatterns(options.hiddenFiles),
        navigationBanner:
            typeof options.navigationBanner === 'string' && options.navigationBanner.length > 0 ? options.navigationBanner : null
    };
}

// Returns the localized name for the default profile, falling back to English if not available
export function getLocalizedDefaultVaultProfileName(): string {
    const localizedName = strings.settings.items.vaultProfiles.defaultName?.trim();
    if (localizedName && localizedName.length > 0) {
        return localizedName;
    }
    return FALLBACK_VAULT_PROFILE_NAME;
}

// Ensures vault profiles are properly initialized with at least one default profile
export function ensureVaultProfiles(settings: NotebookNavigatorSettings): void {
    if (!Array.isArray(settings.vaultProfiles)) {
        settings.vaultProfiles = [];
    }

    if (settings.vaultProfiles.length === 0) {
        settings.vaultProfiles.push(
            createVaultProfile(getLocalizedDefaultVaultProfileName(), {
                id: DEFAULT_VAULT_PROFILE_ID,
                hiddenTags: settings.hiddenTags,
                fileVisibility: settings.fileVisibility
            })
        );
    }

    const hasDefaultProfile = settings.vaultProfiles.some(profile => profile.id === DEFAULT_VAULT_PROFILE_ID);
    if (!hasDefaultProfile) {
        settings.vaultProfiles.unshift(
            createVaultProfile(getLocalizedDefaultVaultProfileName(), {
                id: DEFAULT_VAULT_PROFILE_ID,
                hiddenTags: settings.hiddenTags,
                fileVisibility: settings.fileVisibility
            })
        );
    }

    settings.vaultProfiles.forEach(profile => {
        profile.name = resolveProfileName(profile.name);
        profile.fileVisibility = resolveFileVisibility(profile.fileVisibility ?? settings.fileVisibility);
        profile.hiddenFolders = clonePatterns(profile.hiddenFolders);
        const hiddenTagSource = Array.isArray(profile.hiddenTags) ? profile.hiddenTags : settings.hiddenTags;
        profile.hiddenTags = clonePatterns(hiddenTagSource);
        profile.hiddenFiles = clonePatterns(profile.hiddenFiles);
        profile.navigationBanner =
            typeof profile.navigationBanner === 'string' && profile.navigationBanner.length > 0 ? profile.navigationBanner : null;
    });

    const hasActiveProfile = settings.vaultProfiles.some(profile => profile.id === settings.vaultProfile);
    if (!hasActiveProfile) {
        settings.vaultProfile = DEFAULT_VAULT_PROFILE_ID;
    }
}

// Retrieves the currently active vault profile based on settings
export function getActiveVaultProfile(settings: NotebookNavigatorSettings): VaultProfile {
    ensureVaultProfiles(settings);
    const profile = settings.vaultProfiles.find(item => item.id === settings.vaultProfile) ?? settings.vaultProfiles[0];
    if (!profile) {
        throw new Error('No vault profiles configured');
    }
    return profile;
}

// Returns the list of hidden folder patterns from the active profile
export function getActiveHiddenFolders(settings: NotebookNavigatorSettings): string[] {
    return getActiveVaultProfile(settings).hiddenFolders;
}

// Returns the list of hidden file patterns from the active profile
export function getActiveHiddenFiles(settings: NotebookNavigatorSettings): string[] {
    return getActiveVaultProfile(settings).hiddenFiles;
}

export function getActiveNavigationBanner(settings: NotebookNavigatorSettings): string | null {
    return getActiveVaultProfile(settings).navigationBanner ?? null;
}

// Applies the values from a vault profile to the main settings object
export function applyVaultProfileValues(settings: NotebookNavigatorSettings, profile: VaultProfile): void {
    const hiddenTagSource = Array.isArray(profile.hiddenTags) ? profile.hiddenTags : settings.hiddenTags;
    settings.hiddenTags = clonePatterns(hiddenTagSource);
    settings.fileVisibility = resolveFileVisibility(profile.fileVisibility ?? settings.fileVisibility);
}

// Synchronizes the active profile values to the main settings
export function applyActiveVaultProfileToSettings(settings: NotebookNavigatorSettings): void {
    applyVaultProfileValues(settings, getActiveVaultProfile(settings));
}

// Updates the active profile with current settings values for tags and file visibility
export function syncVaultProfileFromSettings(settings: NotebookNavigatorSettings): void {
    const active = getActiveVaultProfile(settings);
    active.hiddenTags = clonePatterns(settings.hiddenTags);
    active.fileVisibility = resolveFileVisibility(settings.fileVisibility);
}
