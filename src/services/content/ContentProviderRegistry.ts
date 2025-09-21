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

import { TFile } from 'obsidian';
import { IContentProvider, ContentType } from '../../interfaces/IContentProvider';
import { NotebookNavigatorSettings } from '../../settings';

/**
 * Registry for managing content providers
 * Centralizes the registration and coordination of different content generation services
 */
export class ContentProviderRegistry {
    private providers: Map<ContentType, IContentProvider> = new Map();

    /**
     * Registers a content provider
     * @param provider - The provider to register
     */
    registerProvider(provider: IContentProvider): void {
        this.providers.set(provider.getContentType(), provider);
    }

    /**
     * Gets all registered providers
     */
    getAllProviders(): IContentProvider[] {
        return Array.from(this.providers.values());
    }

    /**
     * Gets a specific provider by content type
     */
    getProvider(type: ContentType): IContentProvider | undefined {
        return this.providers.get(type);
    }

    /**
     * Gets all settings that affect any content generation
     */
    getAllRelevantSettings(): (keyof NotebookNavigatorSettings)[] {
        const allSettings = new Set<keyof NotebookNavigatorSettings>();

        for (const provider of this.providers.values()) {
            const settings = provider.getRelevantSettings();
            settings.forEach(setting => allSettings.add(setting));
        }

        return Array.from(allSettings);
    }

    /**
     * Handles settings changes by notifying affected providers
     * @param oldSettings - Previous settings
     * @param newSettings - New settings
     * @returns Promise that resolves when all affected providers have been notified
     */
    async handleSettingsChange(oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings): Promise<void> {
        const clearPromises: Promise<void>[] = [];
        const affectedProviders: IContentProvider[] = [];

        // Check each provider to see if it's affected
        for (const provider of this.providers.values()) {
            if (provider.shouldRegenerate(oldSettings, newSettings)) {
                // Clear content for this provider
                clearPromises.push(provider.clearContent());
                affectedProviders.push(provider);
            }

            // Always notify providers of settings changes
            provider.onSettingsChanged(newSettings);
        }

        // Wait for all clear operations to complete
        if (clearPromises.length > 0) {
            await Promise.all(clearPromises);
        }

        // Return the list of affected providers for regeneration
        return;
    }

    /**
     * Queues files for content generation across all providers
     * @param files - Files to queue
     * @param settings - Current settings
     * @param options - Optional filtering to include or exclude specific content types
     */
    queueFilesForAllProviders(
        files: TFile[],
        settings: NotebookNavigatorSettings,
        options?: { include?: ContentType[]; exclude?: ContentType[] }
    ): void {
        const include = options?.include;
        const exclude = options?.exclude;

        for (const provider of this.providers.values()) {
            const type = provider.getContentType();

            // Skip providers not in the include list (if specified)
            if (include && !include.includes(type)) {
                continue;
            }

            // Skip providers in the exclude list (if specified)
            if (exclude && exclude.includes(type)) {
                continue;
            }

            // Queue files and start processing for this provider
            provider.queueFiles(files);
            provider.startProcessing(settings);
        }
    }

    /**
     * Stops all providers' processing
     */
    stopAllProcessing(): void {
        for (const provider of this.providers.values()) {
            provider.stopProcessing();
        }
    }
}
