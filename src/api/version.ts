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
 * API Version Management
 *
 * Semantic versioning for the API:
 * - MAJOR: Breaking changes
 * - MINOR: New features (backwards compatible)
 * - PATCH: Bug fixes (backwards compatible)
 */

export const API_VERSION = {
    major: 1,
    minor: 0,
    patch: 0,
    toString(): string {
        return `${this.major}.${this.minor}.${this.patch}`;
    }
};

/**
 * Minimum supported API version
 * APIs older than this will not be supported
 */
const MIN_SUPPORTED_VERSION = {
    major: 1,
    minor: 0,
    patch: 0
};

/**
 * API compatibility levels
 */
export enum CompatibilityLevel {
    /** Full compatibility */
    FULL = 'full',
    /** Partial compatibility with some features unavailable */
    PARTIAL = 'partial',
    /** Limited compatibility, deprecated features in use */
    LIMITED = 'limited',
    /** Incompatible version */
    INCOMPATIBLE = 'incompatible'
}

/**
 * Version compatibility checker
 */
class VersionChecker {
    /**
     * Check if a version is compatible with the current API
     */
    static checkCompatibility(version: string | { major: number; minor: number; patch: number }): CompatibilityLevel {
        const v = typeof version === 'string' ? this.parseVersion(version) : version;

        if (!v) {
            return CompatibilityLevel.INCOMPATIBLE;
        }

        // Same major version = full compatibility
        if (v.major === API_VERSION.major) {
            if (v.minor === API_VERSION.minor) {
                return CompatibilityLevel.FULL;
            }
            // Older minor version = still compatible
            if (v.minor < API_VERSION.minor) {
                return CompatibilityLevel.FULL;
            }
            // Newer minor version = partial (some features may not exist)
            return CompatibilityLevel.PARTIAL;
        }

        // Check if version is too old
        if (v.major < MIN_SUPPORTED_VERSION.major) {
            return CompatibilityLevel.INCOMPATIBLE;
        }

        // Different major version but still supported = limited
        if (v.major < API_VERSION.major && v.major >= MIN_SUPPORTED_VERSION.major) {
            return CompatibilityLevel.LIMITED;
        }

        // Newer major version = incompatible
        return CompatibilityLevel.INCOMPATIBLE;
    }

    /**
     * Parse a version string
     */
    static parseVersion(version: string): { major: number; minor: number; patch: number } | null {
        const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
        if (!match) {
            return null;
        }

        return {
            major: parseInt(match[1], 10),
            minor: parseInt(match[2], 10),
            patch: parseInt(match[3], 10)
        };
    }

    /**
     * Check if a feature is available in a given version
     */
    static isFeatureAvailable(feature: string, version: string): boolean {
        const features = FEATURE_VERSIONS[feature];
        if (!features) {
            return false;
        }

        const v = this.parseVersion(version);
        if (!v) {
            return false;
        }

        const required = this.parseVersion(features);
        if (!required) {
            return false;
        }

        // Feature is available if version is >= required version
        if (v.major > required.major) return true;
        if (v.major < required.major) return false;
        if (v.minor > required.minor) return true;
        if (v.minor < required.minor) return false;
        return v.patch >= required.patch;
    }
}

/**
 * Map of features - all features are available in v1.0.0
 */
const FEATURE_VERSIONS: Record<string, string> = {
    // File operations
    'file.delete': '1.0.0',
    'file.moveTo': '1.0.0',

    // Metadata operations
    'metadata.setFolderColor': '1.0.0',
    'metadata.clearFolderColor': '1.0.0',
    'metadata.setFolderIcon': '1.0.0',
    'metadata.clearFolderIcon': '1.0.0',
    'metadata.setTagColor': '1.0.0',
    'metadata.clearTagColor': '1.0.0',
    'metadata.setTagIcon': '1.0.0',
    'metadata.clearTagIcon': '1.0.0',
    'metadata.pin': '1.0.0',
    'metadata.unpin': '1.0.0',
    'metadata.togglePin': '1.0.0',
    'metadata.listPinnedFiles': '1.0.0',

    // Navigation operations
    'navigation.navigateToFile': '1.0.0',

    // Selection operations
    'selection.getSelectionState': '1.0.0',
    'selection.getSelectedNavigationItem': '1.0.0',

    // Events
    'events.storage-ready': '1.0.0',
    'events.folder-selected': '1.0.0',
    'events.tag-selected': '1.0.0',
    'events.file-selection-changed': '1.0.0',
    'events.pinned-files-changed': '1.0.0',
    'events.folder-metadata-changed': '1.0.0',
    'events.tag-metadata-changed': '1.0.0'
};

/**
 * API version negotiation result
 */
export interface VersionNegotiation {
    /** The API version being used */
    apiVersion: string;
    /** Compatibility level */
    compatibility: CompatibilityLevel;
    /** Available features for this compatibility level */
    availableFeatures: string[];
    /** Deprecated features being used */
    deprecatedFeatures: string[];
}

/**
 * Negotiate API version with a client
 */
export function negotiateVersion(clientVersion: string): VersionNegotiation {
    const compatibility = VersionChecker.checkCompatibility(clientVersion);
    const availableFeatures: string[] = [];
    const deprecatedFeatures: string[] = [];

    // Determine available features
    for (const [feature] of Object.entries(FEATURE_VERSIONS)) {
        if (VersionChecker.isFeatureAvailable(feature, clientVersion)) {
            availableFeatures.push(feature);
        }
    }

    return {
        apiVersion: API_VERSION.toString(),
        compatibility,
        availableFeatures,
        deprecatedFeatures
    };
}
