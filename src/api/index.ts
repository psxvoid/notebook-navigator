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
 * Public API exports for Notebook Navigator
 *
 * This file exports all public types and interfaces that external
 * plugins can use when integrating with Notebook Navigator.
 */

// Main API class
export { NotebookNavigatorAPI } from './NotebookNavigatorAPI';

// Core types
export type {
    TagRef,
    FolderMetadata,
    TagMetadata,
    MoveResult,
    SelectionState,
    NotebookNavigatorEventType,
    NotebookNavigatorEvents,
    EventBus
} from './types';

// Version management
export { API_VERSION, CompatibilityLevel } from './version';
export type { VersionNegotiation } from './version';

// Module APIs (for type reference, not direct instantiation)
export type { FileAPI } from './modules/FileAPI';
export type { MetadataAPI } from './modules/MetadataAPI';
export type { NavigationAPI } from './modules/NavigationAPI';
export type { SelectionAPI } from './modules/SelectionAPI';
