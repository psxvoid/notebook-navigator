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
 * API Feature Detection and Compatibility
 *
 * This module provides version compatibility checking and feature detection
 * to ensure smooth API evolution and backwards compatibility.
 */

import type { NotebookNavigatorAPI } from './NotebookNavigatorAPI';
import { VersionChecker, CompatibilityLevel } from './version';

/**
 * Feature detection for API capabilities
 */
export class FeatureDetector {
    /**
     * Check if a feature is available in the current API
     */
    static hasFeature(api: NotebookNavigatorAPI, feature: string): boolean {
        switch (feature) {
            case 'navigation':
                return !!api.navigation;
            case 'metadata':
                return !!api.metadata;
            case 'file':
                return !!api.file;
            case 'selection':
                return !!api.selection;
            case 'events':
                return typeof api.on === 'function';
            default:
                return false;
        }
    }

    /**
     * Get all available features
     */
    static getAvailableFeatures(api: NotebookNavigatorAPI): string[] {
        const features = ['navigation', 'metadata', 'file', 'selection', 'events'];
        return features.filter(feature => this.hasFeature(api, feature));
    }
}

/**
 * Compatibility adapter for different API versions
 */
export class CompatibilityAdapter {
    private compatibilityLevel: CompatibilityLevel;

    constructor(
        private api: NotebookNavigatorAPI,
        clientVersion: string
    ) {
        this.compatibilityLevel = VersionChecker.checkCompatibility(clientVersion);
    }

    /**
     * Get compatibility level
     */
    getCompatibilityLevel(): CompatibilityLevel {
        return this.compatibilityLevel;
    }

    /**
     * Wrap the API with compatibility layer
     */
    wrapAPI(): NotebookNavigatorAPI {
        // For now, just return the API directly
        // In the future, this could return a proxy that handles version differences
        return this.api;
    }
}
