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
 * Deprecation management utilities
 */

/**
 * Deprecation information
 */
export interface DeprecationInfo {
    /** The deprecated feature/method name */
    feature: string;
    /** Version when deprecated */
    deprecatedInVersion: string;
    /** Version when it will be removed */
    removeInVersion?: string;
    /** Replacement feature/method to use instead */
    replacement?: string;
    /** Additional migration instructions */
    migrationGuide?: string;
}

/**
 * Registry of deprecated features
 */
export class DeprecationRegistry {
    private static deprecations = new Map<string, DeprecationInfo>();
    private static warnedFeatures = new Set<string>();

    /**
     * Register a deprecated feature
     */
    static register(info: DeprecationInfo): void {
        this.deprecations.set(info.feature, info);
    }

    /**
     * Get deprecation info for a feature
     */
    static getInfo(feature: string): DeprecationInfo | undefined {
        return this.deprecations.get(feature);
    }

    /**
     * Warn about deprecated feature usage (only once per feature)
     */
    static warn(feature: string): void {
        if (this.warnedFeatures.has(feature)) {
            return;
        }

        const info = this.deprecations.get(feature);
        if (!info) {
            return;
        }

        this.warnedFeatures.add(feature);

        let message = `⚠️ Notebook Navigator API: '${feature}' is deprecated since version ${info.deprecatedInVersion}`;

        if (info.removeInVersion) {
            message += ` and will be removed in version ${info.removeInVersion}`;
        }

        if (info.replacement) {
            message += `\n  Use '${info.replacement}' instead`;
        }

        if (info.migrationGuide) {
            message += `\n  Migration guide: ${info.migrationGuide}`;
        }

        console.warn(message);
    }

    /**
     * Clear warned features (useful for testing)
     */
    static clearWarnings(): void {
        this.warnedFeatures.clear();
    }

    /**
     * Get all deprecated features
     */
    static getAllDeprecations(): DeprecationInfo[] {
        return Array.from(this.deprecations.values());
    }

    /**
     * Check if a feature is deprecated
     */
    static isDeprecated(feature: string): boolean {
        return this.deprecations.has(feature);
    }
}

/**
 * Decorator to mark a method as deprecated
 */
export function deprecated(info: Omit<DeprecationInfo, 'feature'>) {
    return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        // Get constructor name safely
        const className = (target as { constructor: { name: string } }).constructor.name;

        // Register the deprecation
        DeprecationRegistry.register({
            ...info,
            feature: `${className}.${propertyKey}`
        });

        descriptor.value = function (...args: unknown[]) {
            // Warn about usage
            DeprecationRegistry.warn(`${className}.${propertyKey}`);

            // Call the original method
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * Create a deprecated wrapper for a function
 */
export function createDeprecatedWrapper<T extends (...args: unknown[]) => unknown>(fn: T, info: DeprecationInfo): T {
    DeprecationRegistry.register(info);

    return ((...args: unknown[]) => {
        DeprecationRegistry.warn(info.feature);
        return fn(...args);
    }) as T;
}

/**
 * Mark when using a deprecated parameter
 */
export function deprecatedParameter(parameterName: string, methodName: string, info: Partial<DeprecationInfo>): void {
    const feature = `${methodName}(${parameterName})`;

    DeprecationRegistry.register({
        feature,
        deprecatedInVersion: info.deprecatedInVersion || '1.0.0',
        removeInVersion: info.removeInVersion,
        replacement: info.replacement,
        migrationGuide: info.migrationGuide
    });

    DeprecationRegistry.warn(feature);
}

/**
 * Batch check for deprecated features in use
 */
export function checkDeprecatedFeatures(features: string[]): {
    deprecated: string[];
    warnings: string[];
} {
    const deprecated: string[] = [];
    const warnings: string[] = [];

    for (const feature of features) {
        if (DeprecationRegistry.isDeprecated(feature)) {
            deprecated.push(feature);

            const info = DeprecationRegistry.getInfo(feature);
            if (info) {
                let warning = `'${feature}' is deprecated`;
                if (info.replacement) {
                    warning += `, use '${info.replacement}' instead`;
                }
                warnings.push(warning);
            }
        }
    }

    return { deprecated, warnings };
}

/**
 * Example deprecations (these would be real in production)
 */
export function registerExampleDeprecations(): void {
    // Example: If we ever change the API structure
    /*
    DeprecationRegistry.register({
        feature: 'NotebookNavigatorAPI.getSelection',
        deprecatedInVersion: '1.1.0',
        removeInVersion: '2.0.0',
        replacement: 'NotebookNavigatorAPI.selection.getSelection',
        migrationGuide: 'Access selection methods through the selection sub-API'
    });
    */
}
