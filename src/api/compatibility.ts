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

import type { NotebookNavigatorAPI } from './NotebookNavigatorAPI';
import { DeprecationRegistry } from './deprecation';
import { CompatibilityLevel, VersionChecker } from './version';

/**
 * Backwards compatibility layer for API changes
 */

/**
 * Feature detection helper
 */
export class FeatureDetector {
    /**
     * Check if a feature exists in the current API
     */
    static hasFeature(api: NotebookNavigatorAPI, feature: string): boolean {
        const parts = feature.split('.');
        let current: unknown = api;

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = (current as Record<string, unknown>)[part];
            } else {
                return false;
            }
        }

        return current !== undefined;
    }

    /**
     * Get available features for an API instance
     */
    static getAvailableFeatures(api: NotebookNavigatorAPI): string[] {
        const features: string[] = [];

        // Check main API modules
        const modules = ['fileSystem', 'metadata', 'navigation', 'selection', 'storage', 'tags', 'view'];

        for (const module of modules) {
            if (this.hasFeature(api, module)) {
                features.push(module);

                // Check sub-features
                const moduleObj = (api as unknown as Record<string, unknown>)[module];
                if (moduleObj && typeof moduleObj === 'object') {
                    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(moduleObj)).filter(
                        name => name !== 'constructor' && typeof (moduleObj as Record<string, unknown>)[name] === 'function'
                    );

                    for (const method of methods) {
                        features.push(`${module}.${method}`);
                    }
                }
            }
        }

        return features;
    }
}

/**
 * Compatibility adapter for different API versions
 */
export class CompatibilityAdapter {
    private compatibilityLevel: CompatibilityLevel;

    constructor(
        private api: NotebookNavigatorAPI,
        private clientVersion: string
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
     * Wrap API with compatibility layer
     */
    wrapAPI(): NotebookNavigatorAPI {
        if (this.compatibilityLevel === CompatibilityLevel.FULL) {
            // No wrapping needed for full compatibility
            return this.api;
        }

        // Create a proxy to handle compatibility
        return new Proxy(this.api, {
            get: (target, prop: string) => {
                // Check if accessing a deprecated feature
                if (DeprecationRegistry.isDeprecated(prop)) {
                    DeprecationRegistry.warn(prop);
                }

                // Handle version-specific adaptations
                if (this.compatibilityLevel === CompatibilityLevel.LIMITED) {
                    return this.handleLimitedCompatibility(target, prop);
                }

                if (this.compatibilityLevel === CompatibilityLevel.PARTIAL) {
                    return this.handlePartialCompatibility(target, prop);
                }

                // Default: return original property
                return (target as unknown as Record<string, unknown>)[prop];
            }
        });
    }

    /**
     * Handle limited compatibility (older API versions)
     */
    private handleLimitedCompatibility(target: NotebookNavigatorAPI, prop: string): unknown {
        // Example: Map old API calls to new structure
        // This would contain real mappings in production

        const value = (target as unknown as Record<string, unknown>)[prop];

        // If property doesn't exist, check for alternatives
        if (value === undefined) {
            // Check if there's a compatibility mapping
            const mapping = this.getCompatibilityMapping(prop);
            if (mapping) {
                console.warn(`API compatibility: '${prop}' mapped to '${mapping}'`);
                return (target as unknown as Record<string, unknown>)[mapping];
            }
        }

        return value;
    }

    /**
     * Handle partial compatibility (newer client versions)
     */
    private handlePartialCompatibility(target: NotebookNavigatorAPI, prop: string): unknown {
        const value = (target as unknown as Record<string, unknown>)[prop];

        if (value === undefined) {
            // Feature doesn't exist in this version
            console.warn(`API feature '${prop}' is not available in this plugin version`);

            // Return a stub that throws a helpful error
            return () => {
                throw new Error(`Feature '${prop}' requires a newer version of Notebook Navigator`);
            };
        }

        return value;
    }

    /**
     * Get compatibility mapping for old property names
     */
    private getCompatibilityMapping(oldProp: string): string | null {
        // This would contain real mappings in production
        // Example mappings:
        const mappings: Record<string, string> = {
            // 'oldMethodName': 'newMethodName',
            // 'getSelection': 'selection.getSelection',
        };

        return mappings[oldProp] || null;
    }
}

/**
 * Options object builder for future-proof API calls
 */
export class OptionsBuilder<T extends Record<string, unknown>> {
    private options: Partial<T> = {};

    /**
     * Set an option
     */
    set<K extends keyof T>(key: K, value: T[K]): this {
        this.options[key] = value;
        return this;
    }

    /**
     * Set multiple options
     */
    setAll(options: Partial<T>): this {
        Object.assign(this.options, options);
        return this;
    }

    /**
     * Build the options object
     */
    build(): T {
        return this.options as T;
    }

    /**
     * Build with defaults
     */
    buildWithDefaults(defaults: T): T {
        return { ...defaults, ...this.options };
    }
}

/**
 * Create a future-proof method wrapper
 */
export function futureProofMethod<T extends (...args: unknown[]) => unknown>(
    method: T,
    _parameterEvolution?: {
        addedIn?: Record<string, string>; // parameter -> version
        removedIn?: Record<string, string>; // parameter -> version
        renamedIn?: Record<string, { from: string; to: string; version: string }>;
    }
): T {
    return ((...args: unknown[]) => {
        // Could add parameter validation/transformation based on version
        // For now, just pass through
        return method(...args);
    }) as T;
}

/**
 * Graceful fallback wrapper
 */
export function withFallback<T>(primary: () => T, fallback: () => T, errorMessage?: string): T {
    try {
        return primary();
    } catch (error) {
        if (errorMessage) {
            console.warn(errorMessage, error);
        }
        return fallback();
    }
}

/**
 * Safe property access with fallback
 */
export function safeAccess<T>(obj: unknown, path: string, defaultValue: T): T {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
            current = (current as Record<string, unknown>)[part];
        } else {
            return defaultValue;
        }
    }

    return (current as T) ?? defaultValue;
}
