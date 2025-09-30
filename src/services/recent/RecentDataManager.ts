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

import type { NotebookNavigatorSettings } from '../../settings';
import type { LocalStorageKeys } from '../../types';
import { RecentStorageService } from '../RecentStorageService';

interface RecentDataManagerOptions {
    settings: NotebookNavigatorSettings;
    keys: LocalStorageKeys;
    onRecentDataChange: () => void;
}

/**
 * Wraps RecentStorageService lifecycle so the plugin stops hosting persistence helpers.
 */
export default class RecentDataManager {
    private storage: RecentStorageService | null = null;
    private readonly options: RecentDataManagerOptions;

    constructor(options: RecentDataManagerOptions) {
        this.options = options;
    }

    initialize(): void {
        this.dispose();
        this.storage = new RecentStorageService({
            settings: this.options.settings,
            keys: this.options.keys,
            notifyChange: this.options.onRecentDataChange
        });
        this.storage.hydrate();
        this.options.onRecentDataChange();
    }

    dispose(): void {
        this.storage?.flushPendingPersists();
        this.storage = null;
    }

    getRecentNotes(): string[] {
        return this.storage?.getRecentNotes() ?? [];
    }

    setRecentNotes(recentNotes: string[]): void {
        this.storage?.setRecentNotes(recentNotes);
    }

    applyRecentNotesLimit(): void {
        this.storage?.applyRecentNotesLimit();
    }

    getRecentIcons(): Record<string, string[]> {
        return this.storage?.getRecentIcons() ?? {};
    }

    setRecentIcons(recentIcons: Record<string, string[]>): void {
        this.storage?.setRecentIcons(recentIcons);
    }

    flushPendingPersists(): void {
        this.storage?.flushPendingPersists();
    }
}
