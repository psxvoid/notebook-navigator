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

import { IconProvider, IconDefinition, ParsedIconId, IconServiceConfig } from './types';

/**
 * Central service for managing icon providers and rendering icons.
 *
 * The IconService acts as a registry and coordinator for multiple icon providers,
 * allowing the plugin to support different icon sets (Lucide, Emoji, etc.) through
 * a unified interface. Key features include:
 *
 * - Provider registration and management
 * - Icon ID parsing with provider prefixes (e.g., "emoji:📁" or plain "folder")
 * - Recent icons tracking for improved user experience
 * - Fallback to default provider for backward compatibility
 * - Unified search across all providers
 *
 * The service uses a singleton pattern to ensure consistent state across the plugin.
 */
export class IconService {
    private static instance: IconService;
    private providers = new Map<string, IconProvider>();
    private config: IconServiceConfig;
    private recentIcons: string[] = [];
    private static readonly DEFAULT_PROVIDER = 'lucide';
    private static readonly RECENT_ICONS_STORAGE_KEY = 'nn-recent-icons';

    private constructor(config: IconServiceConfig = {}) {
        this.config = {
            defaultProvider: IconService.DEFAULT_PROVIDER,
            recentIconsLimit: 20,
            ...config
        };
        this.loadRecentIcons();
    }

    /**
     * Gets the singleton instance of the IconService.
     * Creates a new instance on first call.
     *
     * @param config - Optional configuration for the service
     * @returns The IconService instance
     */
    static getInstance(config?: IconServiceConfig): IconService {
        if (!IconService.instance) {
            IconService.instance = new IconService(config);
        }
        return IconService.instance;
    }

    /**
     * Registers an icon provider with the service.
     * Only registers providers that report as available.
     *
     * @param provider - The icon provider to register
     */
    registerProvider(provider: IconProvider): void {
        if (!provider.isAvailable()) {
            return;
        }
        this.providers.set(provider.id, provider);
    }

    unregisterProvider(providerId: string): void {
        this.providers.delete(providerId);
    }

    getProvider(providerId: string): IconProvider | undefined {
        return this.providers.get(providerId);
    }

    getAllProviders(): IconProvider[] {
        return Array.from(this.providers.values());
    }

    /**
     * Parses an icon ID into provider and identifier components.
     * Handles both prefixed ("provider:icon") and plain ("icon") formats.
     *
     * @param iconId - The icon ID to parse
     * @returns Parsed icon information
     */
    parseIconId(iconId: string): ParsedIconId {
        const colonIndex = iconId.indexOf(':');

        if (colonIndex === -1) {
            // No provider specified - this is a legacy Lucide icon
            return {
                provider: this.config.defaultProvider || IconService.DEFAULT_PROVIDER,
                identifier: iconId,
                raw: iconId
            };
        }

        return {
            provider: iconId.substring(0, colonIndex),
            identifier: iconId.substring(colonIndex + 1),
            raw: iconId
        };
    }

    /**
     * Formats an icon ID with appropriate provider prefix.
     * Omits prefix for default provider to maintain backward compatibility.
     *
     * @param provider - The provider ID
     * @param identifier - The icon identifier
     * @returns Formatted icon ID
     */
    formatIconId(provider: string, identifier: string): string {
        if (provider === this.config.defaultProvider || provider === IconService.DEFAULT_PROVIDER) {
            return identifier;
        }
        return `${provider}:${identifier}`;
    }

    /**
     * Renders an icon into the specified container.
     * Automatically tracks recently used icons.
     *
     * @param container - The HTML element to render into
     * @param iconId - The icon ID (with or without provider prefix)
     * @param size - Optional size in pixels
     */
    renderIcon(container: HTMLElement, iconId: string, size?: number): void {
        if (!iconId) {
            container.empty();
            return;
        }

        const parsed = this.parseIconId(iconId);
        const provider = this.providers.get(parsed.provider);

        if (!provider) {
            console.log(`[IconService] Icon provider not found: ${parsed.provider} for icon: ${iconId}`);
            container.empty();
            return;
        }

        try {
            provider.render(container, parsed.identifier, size);
            this.addToRecentIcons(iconId);
        } catch (error) {
            console.log(`[IconService] Error rendering icon ${iconId}: ${error}`);
            container.empty();
        }
    }

    /**
     * Searches for icons across providers.
     *
     * @param query - The search query
     * @param providerId - Optional provider ID to limit search
     * @returns Array of matching icon definitions
     */
    search(query: string, providerId?: string): IconDefinition[] {
        if (providerId) {
            const provider = this.providers.get(providerId);
            return provider ? provider.search(query) : [];
        }

        const results: IconDefinition[] = [];
        for (const provider of this.providers.values()) {
            const providerResults = provider.search(query);
            results.push(
                ...providerResults.map(icon => ({
                    ...icon,
                    id: this.formatIconId(provider.id, icon.id)
                }))
            );
        }
        return results;
    }

    /**
     * Gets all available icons from providers.
     *
     * @param providerId - Optional provider ID to limit results
     * @returns Array of all icon definitions
     */
    getAllIcons(providerId?: string): IconDefinition[] {
        if (providerId) {
            const provider = this.providers.get(providerId);
            return provider ? provider.getAll() : [];
        }

        const results: IconDefinition[] = [];
        for (const provider of this.providers.values()) {
            const providerIcons = provider.getAll();
            results.push(
                ...providerIcons.map(icon => ({
                    ...icon,
                    id: this.formatIconId(provider.id, icon.id)
                }))
            );
        }
        return results;
    }

    getRecentIcons(): string[] {
        return [...this.recentIcons];
    }

    private addToRecentIcons(iconId: string): void {
        const index = this.recentIcons.indexOf(iconId);
        if (index > -1) {
            this.recentIcons.splice(index, 1);
        }

        this.recentIcons.unshift(iconId);

        if (this.recentIcons.length > (this.config.recentIconsLimit || 20)) {
            this.recentIcons = this.recentIcons.slice(0, this.config.recentIconsLimit);
        }

        this.saveRecentIcons();
    }

    private loadRecentIcons(): void {
        try {
            const stored = localStorage.getItem(IconService.RECENT_ICONS_STORAGE_KEY);
            if (stored) {
                this.recentIcons = JSON.parse(stored);
            }
        } catch (error) {
            console.log(`Error loading recent icons: ${error}`);
            this.recentIcons = [];
        }
    }

    private saveRecentIcons(): void {
        try {
            localStorage.setItem(IconService.RECENT_ICONS_STORAGE_KEY, JSON.stringify(this.recentIcons));
        } catch (error) {
            console.log(`Error saving recent icons: ${error}`);
        }
    }

    /**
     * Checks if an icon ID is valid and available.
     *
     * @param iconId - The icon ID to validate
     * @returns True if the icon exists in its provider
     */
    isValidIcon(iconId: string): boolean {
        const parsed = this.parseIconId(iconId);
        const provider = this.providers.get(parsed.provider);

        if (!provider) {
            return false;
        }

        const allIcons = provider.getAll();
        return allIcons.some(icon => icon.id === parsed.identifier);
    }
}
