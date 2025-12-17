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
import type { ShortcutEntry } from '../types/shortcuts';
import { strings } from '../i18n';
import { FILE_VISIBILITY, type FileVisibility } from './fileTypeUtils';
import { showNotice } from './noticeUtils';
import { stripTrailingSlash } from './pathUtils';
import { normalizeTagPath } from './tagUtils';
import { createHiddenTagMatcher, matchesHiddenTagPattern, getHiddenTagPathPatterns, normalizeTagPathValue } from './tagPrefixMatcher';
import {
    createPathPatternMatcher,
    getPathPatternCacheKey,
    getNormalizedPathSegments,
    matchesLiteralPrefix,
    parsePathPattern,
    rebuildPattern,
    type PathPatternMatcher,
    type ParsedPathPattern
} from './pathPatternMatcher';

export const DEFAULT_VAULT_PROFILE_ID = 'default';
const FALLBACK_VAULT_PROFILE_NAME = 'Default';

interface VaultProfileInitOptions {
    id?: string;
    hiddenFolders?: string[];
    hiddenFiles?: string[];
    hiddenFileNamePatterns?: string[];
    hiddenTags?: string[];
    fileVisibility?: FileVisibility;
    navigationBanner?: string | null;
    shortcuts?: ShortcutEntry[];
}

// Hidden folder pattern rules (all patterns must be absolute with a leading "/"):
// - "/folder/*" hides descendants while keeping the folder visible
// - "/folder*" hides the folder and its descendants
const normalizePathPattern = (pattern: string): string => {
    const normalized = normalizeHiddenFolderPath(pattern);
    if (!normalized) {
        return '';
    }
    // Collapse multiple slashes inside the pattern while preserving trailing wildcard characters
    const parts = normalized.split('/').filter(Boolean);
    return parts.length === 0 ? '/' : `/${parts.join('/')}`;
};

const parseHiddenFolderPattern = (pattern: string): ParsedPathPattern | null => {
    return parsePathPattern(pattern, { normalizePattern: normalizePathPattern, requireRoot: true });
};

// Cache compiled hidden-folder matchers keyed by the normalized pattern list.
const hiddenFolderMatcherCache = new Map<string, PathPatternMatcher>();

export const getHiddenFolderMatcher = (patterns: string[]): PathPatternMatcher => {
    const cacheKey = getPathPatternCacheKey(patterns);
    const cached = hiddenFolderMatcherCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const matcher = createPathPatternMatcher(patterns, {
        normalizePattern: normalizePathPattern,
        normalizePath: normalizeHiddenFolderPath,
        requireRoot: true
    });

    hiddenFolderMatcherCache.set(cacheKey, matcher);
    return matcher;
};

// Clears all cached hidden-folder matchers.
export const clearHiddenFolderMatcherCache = (): void => {
    hiddenFolderMatcherCache.clear();
};

// Normalizes a folder path to the canonical format used in hidden folder settings
export function normalizeHiddenFolderPath(value: string): string {
    if (!value) {
        return '';
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return '';
    }

    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return stripTrailingSlash(withLeadingSlash);
}

const isHiddenFolderPathPattern = (pattern: string): boolean => {
    return typeof pattern === 'string' && pattern.startsWith('/');
};

export interface HiddenFolderPatternMatch {
    normalizedPrefix: string;
    rebuildPattern: (nextPrefix: string) => string;
}

export const getHiddenFolderPatternMatch = (pattern: string): HiddenFolderPatternMatch | null => {
    if (!isHiddenFolderPathPattern(pattern)) {
        return null;
    }

    const parsed = parseHiddenFolderPattern(pattern);
    if (!parsed || parsed.literalPrefixLength === 0) {
        return null;
    }

    const normalizedPrefixSegments = parsed.segments.slice(0, parsed.literalPrefixLength).map(segment => {
        return segment.type === 'literal' ? segment.value : '';
    });
    const normalizedPrefix = normalizeHiddenFolderPath(`/${normalizedPrefixSegments.join('/')}`);

    return {
        normalizedPrefix,
        rebuildPattern: (nextPrefix: string) => {
            const normalizedNext = normalizeHiddenFolderPath(nextPrefix);
            if (!normalizedNext) {
                return '';
            }

            const nextSegments = getNormalizedPathSegments(normalizedNext, normalizeHiddenFolderPath);
            return rebuildPattern(parsed, nextSegments, {
                addLeadingSlash: true,
                normalizePattern: normalizeHiddenFolderPath
            });
        }
    };
};

// Creates a clean copy of pattern array, trimming and filtering out empty strings
const clonePatterns = (patterns: string[] | undefined): string[] => {
    if (!Array.isArray(patterns)) {
        return [];
    }
    return patterns.map(pattern => pattern.trim()).filter(pattern => pattern.length > 0);
};

// Creates a clone of shortcuts array to prevent shared references
export const cloneShortcuts = (shortcuts: ShortcutEntry[] | undefined): ShortcutEntry[] => {
    if (!Array.isArray(shortcuts)) {
        return [];
    }
    return shortcuts.map(shortcut => ({ ...shortcut }));
};

// Applies a transformation function to shortcuts for every profile that has entries
export const mutateVaultProfileShortcuts = (
    profiles: VaultProfile[] | undefined,
    transform: (shortcuts: ShortcutEntry[]) => ShortcutEntry[] | null | undefined
): boolean => {
    if (!Array.isArray(profiles) || profiles.length === 0) {
        return false;
    }

    let didChange = false;

    profiles.forEach(profile => {
        if (!Array.isArray(profile.shortcuts) || profile.shortcuts.length === 0) {
            return;
        }

        const next = transform(profile.shortcuts);
        if (!next) {
            return;
        }

        profile.shortcuts = next;
        didChange = true;
    });

    return didChange;
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
        hiddenFileNamePatterns: clonePatterns(options.hiddenFileNamePatterns),
        navigationBanner:
            typeof options.navigationBanner === 'string' && options.navigationBanner.length > 0 ? options.navigationBanner : null,
        shortcuts: cloneShortcuts(options.shortcuts)
    };
}

// Creates a vault profile using values from an existing profile with optional fallbacks
export interface VaultProfileTemplateOptions {
    sourceProfile?: VaultProfile | null;
    fallbackHiddenTags?: string[];
    fallbackFileVisibility?: FileVisibility;
}

function createVaultProfileFromTemplate(name: string, template: VaultProfileTemplateOptions = {}): VaultProfile {
    const source = template.sourceProfile ?? null;
    return createVaultProfile(name, {
        hiddenFolders: source?.hiddenFolders,
        hiddenFiles: source?.hiddenFiles,
        hiddenFileNamePatterns: source?.hiddenFileNamePatterns,
        hiddenTags: source?.hiddenTags ?? template.fallbackHiddenTags,
        fileVisibility: source?.fileVisibility ?? template.fallbackFileVisibility,
        navigationBanner: source?.navigationBanner,
        shortcuts: source?.shortcuts
    });
}

export type VaultProfileNameError = 'empty' | 'duplicate';

// Validates a candidate profile name and returns a specific error code on failure
function validateVaultProfileName(
    profiles: VaultProfile[] | null | undefined,
    candidateName: string,
    options: { excludeId?: string } = {}
): VaultProfileNameError | null {
    const trimmed = candidateName.trim();
    if (!trimmed) {
        return 'empty';
    }

    if (hasVaultProfileNameDuplicate(profiles, trimmed, options)) {
        return 'duplicate';
    }

    return null;
}

// Creates a profile from the provided template after validating the name
export function createValidatedVaultProfileFromTemplate(
    profiles: VaultProfile[] | null | undefined,
    name: string,
    template: VaultProfileTemplateOptions = {}
): { profile: VaultProfile } | { error: VaultProfileNameError } {
    const validationError = validateVaultProfileName(profiles, name);
    if (validationError) {
        return { error: validationError };
    }

    return {
        profile: createVaultProfileFromTemplate(name.trim(), template)
    };
}

// Validates a profile name and shows a warning notice on failure
export function validateVaultProfileNameOrNotify(
    profiles: VaultProfile[] | null | undefined,
    candidateName: string,
    options: { excludeId?: string } = {}
): string | null {
    const validationError = validateVaultProfileName(profiles, candidateName, options);
    if (!validationError) {
        return candidateName.trim();
    }

    if (validationError === 'empty') {
        showNotice(strings.settings.items.vaultProfiles.errors.emptyName, { variant: 'warning' });
        return null;
    }

    if (validationError === 'duplicate') {
        showNotice(strings.settings.items.vaultProfiles.errors.duplicateName, { variant: 'warning' });
        return null;
    }

    return null;
}

// Checks if a profile name already exists in the list (case-insensitive comparison)
function hasVaultProfileNameDuplicate(
    profiles: VaultProfile[] | null | undefined,
    candidateName: string,
    options: { excludeId?: string } = {}
): boolean {
    if (!Array.isArray(profiles)) {
        return false;
    }

    const normalizedCandidate = candidateName.trim().toLowerCase();
    if (!normalizedCandidate) {
        return false;
    }

    return profiles.some(profile => {
        if (options.excludeId && profile.id === options.excludeId) {
            return false;
        }
        const normalizedProfileName = (profile.name ?? '').trim().toLowerCase();
        return normalizedProfileName === normalizedCandidate;
    });
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
                id: DEFAULT_VAULT_PROFILE_ID
            })
        );
    }

    const hasDefaultProfile = settings.vaultProfiles.some(profile => profile.id === DEFAULT_VAULT_PROFILE_ID);
    if (!hasDefaultProfile) {
        settings.vaultProfiles.unshift(
            createVaultProfile(getLocalizedDefaultVaultProfileName(), {
                id: DEFAULT_VAULT_PROFILE_ID
            })
        );
    }

    settings.vaultProfiles.forEach(profile => {
        profile.name = resolveProfileName(profile.name);
        profile.fileVisibility = resolveFileVisibility(profile.fileVisibility);
        profile.hiddenFolders = clonePatterns(profile.hiddenFolders);
        const hiddenTagSource = Array.isArray(profile.hiddenTags) ? profile.hiddenTags : [];
        profile.hiddenTags = clonePatterns(hiddenTagSource);
        profile.hiddenFiles = clonePatterns(profile.hiddenFiles);
        profile.hiddenFileNamePatterns = clonePatterns(profile.hiddenFileNamePatterns);
        profile.navigationBanner =
            typeof profile.navigationBanner === 'string' && profile.navigationBanner.length > 0 ? profile.navigationBanner : null;
        profile.shortcuts = cloneShortcuts(profile.shortcuts);
    });

    const hasActiveProfile = settings.vaultProfiles.some(profile => profile.id === settings.vaultProfile);
    if (!hasActiveProfile) {
        settings.vaultProfile = DEFAULT_VAULT_PROFILE_ID;
    }
}

// Retrieves the currently active vault profile based on settings.
// Assumes settings have already been normalized by ensureVaultProfiles.
export function getActiveVaultProfile(settings: NotebookNavigatorSettings): VaultProfile {
    if (!Array.isArray(settings.vaultProfiles) || settings.vaultProfiles.length === 0) {
        throw new Error('No vault profiles configured');
    }
    return findVaultProfileById(settings.vaultProfiles, settings.vaultProfile);
}

// Finds a vault profile by ID or returns the first profile as fallback
export function findVaultProfileById(profiles: VaultProfile[] | undefined, profileId: string | null | undefined): VaultProfile {
    if (!Array.isArray(profiles) || profiles.length === 0) {
        throw new Error('No vault profiles configured');
    }
    if (profileId) {
        const match = profiles.find(profile => profile.id === profileId);
        if (match) {
            return match;
        }
    }
    return profiles[0];
}

// Returns the list of hidden folder patterns from the active profile
export function getActiveHiddenFolders(settings: NotebookNavigatorSettings): string[] {
    return getActiveVaultProfile(settings).hiddenFolders;
}

// Returns the list of hidden file patterns from the active profile
export function getActiveHiddenFiles(settings: NotebookNavigatorSettings): string[] {
    return getActiveVaultProfile(settings).hiddenFiles;
}

export function getActiveHiddenFileNamePatterns(settings: NotebookNavigatorSettings): string[] {
    return getActiveVaultProfile(settings).hiddenFileNamePatterns;
}

export function getActiveHiddenTags(settings: NotebookNavigatorSettings): string[] {
    return getActiveVaultProfile(settings).hiddenTags;
}

export function getActiveFileVisibility(settings: NotebookNavigatorSettings): FileVisibility {
    return getActiveVaultProfile(settings).fileVisibility;
}

export function hasHiddenTagMatch(settings: NotebookNavigatorSettings, normalizedPath: string): boolean {
    ensureVaultProfiles(settings);
    if (!normalizedPath) {
        return false;
    }

    const tagName = normalizedPath.split('/').pop() ?? normalizedPath;
    const pathSegments = normalizedPath.split('/').filter(Boolean);

    return settings.vaultProfiles.some(profile => {
        if (!Array.isArray(profile.hiddenTags) || profile.hiddenTags.length === 0) {
            return false;
        }
        const matcher = createHiddenTagMatcher(profile.hiddenTags);
        if (matchesHiddenTagPattern(normalizedPath, tagName, matcher)) {
            return true;
        }
        // Consider patterns whose literal prefix includes the path (e.g., "projects/*/drafts" when renaming "projects")
        return matcher.pathPatterns.some(pattern => matchesLiteralPrefix(pattern, pathSegments));
    });
}

// Rewrites hidden tag patterns when a tag path is renamed, returning true when any rule changes.
export function updateHiddenTagPrefixMatches(settings: NotebookNavigatorSettings, previousPath: string, nextPath: string): boolean {
    ensureVaultProfiles(settings);
    const normalizedPrevious = normalizeTagPath(previousPath);
    const normalizedNext = normalizeTagPath(nextPath);

    if (!normalizedPrevious || !normalizedNext || normalizedPrevious === normalizedNext) {
        return false;
    }

    const previousSegments = getNormalizedPathSegments(normalizedPrevious, normalizeTagPathValue);
    const nextSegments = getNormalizedPathSegments(normalizedNext, normalizeTagPathValue);

    let didUpdate = false;

    settings.vaultProfiles.forEach(profile => {
        if (!Array.isArray(profile.hiddenTags) || profile.hiddenTags.length === 0) {
            return;
        }

        const parsedPatterns = getHiddenTagPathPatterns(profile.hiddenTags);
        const parsedByRaw = new Map(parsedPatterns.map(pattern => [pattern.raw, pattern]));

        let profileUpdated = false;
        const updatedPatterns = profile.hiddenTags.map(pattern => {
            const parsedPattern = parsedByRaw.get(pattern);
            if (!parsedPattern || parsedPattern.literalPrefixLength === 0 || !matchesLiteralPrefix(parsedPattern, previousSegments)) {
                return pattern;
            }

            const rebuilt = rebuildPattern(parsedPattern, nextSegments, { normalizePattern: normalizeTagPathValue });
            if (rebuilt !== pattern) {
                profileUpdated = true;
            }
            return rebuilt;
        });

        if (profileUpdated) {
            profile.hiddenTags = Array.from(new Set(updatedPatterns));
            didUpdate = true;
        }
    });

    return didUpdate;
}

// Removes hidden tag rules whose literal prefix matches the deleted path, returning true when any rule is removed.
export function removeHiddenTagPrefixMatches(settings: NotebookNavigatorSettings, targetPath: string): boolean {
    ensureVaultProfiles(settings);
    const normalizedTarget = normalizeTagPath(targetPath);
    if (!normalizedTarget) {
        return false;
    }

    const targetSegments = getNormalizedPathSegments(normalizedTarget, normalizeTagPathValue);
    let didUpdate = false;

    settings.vaultProfiles.forEach(profile => {
        if (!Array.isArray(profile.hiddenTags) || profile.hiddenTags.length === 0) {
            return;
        }

        const parsedPatterns = getHiddenTagPathPatterns(profile.hiddenTags);
        const parsedByRaw = new Map(parsedPatterns.map(pattern => [pattern.raw, pattern]));
        let profileUpdated = false;
        const filtered = profile.hiddenTags.filter(pattern => {
            const parsedPattern = parsedByRaw.get(pattern);
            if (!parsedPattern) {
                return true;
            }

            if (!matchesLiteralPrefix(parsedPattern, targetSegments)) {
                return true;
            }

            if (
                parsedPattern.literalPrefixLength < targetSegments.length &&
                parsedPattern.literalPrefixLength < parsedPattern.segments.length
            ) {
                return true;
            }

            profileUpdated = true;
            return false;
        });

        if (profileUpdated) {
            profile.hiddenTags = filtered;
            didUpdate = true;
        }
    });

    return didUpdate;
}

// Updates hidden folder entries across all vault profiles when an exact path match changes
export function updateHiddenFolderExactMatches(settings: NotebookNavigatorSettings, previousPath: string, nextPath: string): boolean {
    ensureVaultProfiles(settings);
    const normalizedPrevious = normalizeHiddenFolderPath(previousPath);
    const normalizedNext = normalizeHiddenFolderPath(nextPath);

    if (!normalizedPrevious || !normalizedNext || normalizedPrevious === normalizedNext) {
        return false;
    }

    const previousSegments = getNormalizedPathSegments(normalizedPrevious, normalizeHiddenFolderPath);
    const nextSegments = getNormalizedPathSegments(normalizedNext, normalizeHiddenFolderPath);

    let didUpdate = false;

    settings.vaultProfiles.forEach(profile => {
        if (!Array.isArray(profile.hiddenFolders) || profile.hiddenFolders.length === 0) {
            return;
        }

        const matcher = getHiddenFolderMatcher(profile.hiddenFolders);
        if (matcher.patterns.length === 0) {
            return;
        }

        const parsedByRaw = new Map(matcher.patterns.map(pattern => [pattern.raw, pattern]));

        let profileUpdated = false;
        const updated = profile.hiddenFolders.map(pattern => {
            const parsed = parsedByRaw.get(pattern);
            if (!parsed || parsed.literalPrefixLength === 0 || !matchesLiteralPrefix(parsed, previousSegments)) {
                return pattern;
            }

            const rebuilt = rebuildPattern(parsed, nextSegments, {
                addLeadingSlash: true,
                normalizePattern: normalizeHiddenFolderPath
            });
            if (rebuilt !== parsed.raw) {
                profileUpdated = true;
            }
            return rebuilt;
        });

        if (profileUpdated) {
            profile.hiddenFolders = Array.from(new Set(updated));
            didUpdate = true;
        }
    });

    return didUpdate;
}

export function removeHiddenFolderExactMatches(settings: NotebookNavigatorSettings, targetPath: string): boolean {
    ensureVaultProfiles(settings);
    const normalizedTarget = normalizeHiddenFolderPath(targetPath);
    if (!normalizedTarget) {
        return false;
    }

    let didUpdate = false;

    settings.vaultProfiles.forEach(profile => {
        if (!Array.isArray(profile.hiddenFolders) || profile.hiddenFolders.length === 0) {
            return;
        }

        const matcher = getHiddenFolderMatcher(profile.hiddenFolders);
        if (matcher.patterns.length === 0) {
            return;
        }

        const parsedByRaw = new Map(matcher.patterns.map(pattern => [pattern.raw, pattern]));
        const targetSegments = getNormalizedPathSegments(normalizedTarget, normalizeHiddenFolderPath);

        let profileUpdated = false;
        const filtered = profile.hiddenFolders.filter(pattern => {
            const parsed = parsedByRaw.get(pattern);
            if (!parsed || parsed.literalPrefixLength === 0) {
                return true;
            }

            if (!matchesLiteralPrefix(parsed, targetSegments)) {
                return true;
            }

            if (parsed.literalPrefixLength < targetSegments.length && parsed.literalPrefixLength < parsed.segments.length) {
                return true;
            }

            profileUpdated = true;
            return false;
        });

        if (profileUpdated) {
            profile.hiddenFolders = filtered;
            didUpdate = true;
        }
    });

    return didUpdate;
}
