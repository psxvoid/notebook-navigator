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

import type { TagTreeService } from '../services/TagTreeService';

/**
 * Minimal plugin interface for contexts that need to trigger API events
 * This avoids circular dependencies while providing type safety
 */
export interface PluginWithAPI {
    api?: {
        trigger: (event: string, data: unknown) => void;
    } | null;
    tagTreeService?: TagTreeService | null;
    registerFileRenameListener?: (id: string, callback: (oldPath: string, newPath: string) => void) => void;
    unregisterFileRenameListener?: (id: string) => void;
}
