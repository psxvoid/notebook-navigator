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
 * Type definitions for the icon service system.
 *
 * This file defines the core interfaces and types used throughout the icon
 * service module, establishing contracts for icon providers and the service.
 */

/**
 * Represents an icon that can be displayed to users.
 */
export interface IconDefinition {
    /** Unique identifier for the icon within its provider */
    id: string;
    /** Human-readable name for display in UI */
    displayName: string;
    /** Optional preview of the icon (e.g., emoji character or SVG) */
    preview?: string;
    /** Optional keywords for improved search */
    keywords?: string[];
}

/**
 * Maximum number of recent icons stored per provider
 */
export const RECENT_ICONS_PER_PROVIDER_LIMIT = 15;

/**
 * Interface that icon providers must implement.
 *
 * Icon providers are responsible for:
 * - Rendering icons into HTML elements
 * - Searching for icons based on queries
 * - Providing a list of all available icons
 * - Reporting their availability status
 */
export interface IconProvider {
    /** Unique identifier for the provider */
    id: string;
    /** Display name for the provider */
    name: string;
    /**
     * Renders an icon into the specified container.
     *
     * @param container - The HTML element to render into
     * @param iconId - The icon identifier
     * @param size - Optional size in pixels
     */
    render(container: HTMLElement, iconId: string, size?: number): void;
    /**
     * Searches for icons matching a query.
     *
     * @param query - The search query
     * @returns Array of matching icon definitions
     */
    search(query: string): IconDefinition[];
    /**
     * Gets all available icons from this provider.
     *
     * @returns Array of all icon definitions
     */
    getAll(): IconDefinition[];
    /**
     * Checks if the provider is available for use.
     *
     * @returns True if the provider can be used
     */
    isAvailable(): boolean;
    /**
     * Optionally reports the provider version displayed to users.
     */
    getVersion?(): string | null;
}

/**
 * Configuration options for the IconService.
 */
export interface IconServiceConfig {
    /** Default provider ID when none is specified */
    defaultProvider?: string;
    /** Maximum number of recent icons to track */
    recentIconsLimit?: number;
}

/**
 * String type alias for icon identifiers.
 * Can be either plain (e.g., "folder") or prefixed (e.g., "emoji:📁").
 */
export type IconId = string;

/**
 * Parsed representation of an icon identifier.
 */
export interface ParsedIconId {
    /** The provider ID (e.g., "lucide", "emoji") */
    provider: string;
    /** The icon identifier within the provider */
    identifier: string;
    /** The original raw icon ID */
    raw: string;
}
