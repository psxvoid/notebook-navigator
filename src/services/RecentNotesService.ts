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
import type { ISettingsProvider } from '../interfaces/ISettingsProvider';
import { RECENT_NOTES_DEFAULT_COUNT } from '../settings';

/**
 * Manages the recent notes list stored in settings
 */
export class RecentNotesService {
    constructor(private readonly settingsProvider: ISettingsProvider) {}

    /**
     * Updates recents when a file is opened
     * @returns true when the list changed
     */
    recordFileOpen(file: TFile): boolean {
        const path = file.path;
        const current = this.ensureRecentNotes();
        const filtered = current.filter(entry => entry !== path);
        filtered.unshift(path);

        const limit = this.getLimit();
        if (filtered.length > limit) {
            filtered.length = limit;
        }

        const changed = filtered.length !== current.length || filtered.some((value, index) => value !== current[index]);
        if (!changed) {
            return false;
        }

        this.settingsProvider.settings.recentNotes = filtered;
        return true;
    }

    /**
     * Updates recents when a file path changes
     * @returns true when the list changed
     */
    renameEntry(oldPath: string, newPath: string): boolean {
        const current = this.ensureRecentNotes();
        if (current.length === 0) {
            return false;
        }

        const limit = this.getLimit();
        const updated: string[] = [];
        const seen = new Set<string>();
        let changed = false;

        for (const entry of current) {
            const candidate = entry === oldPath ? newPath : entry;
            if (candidate !== entry) {
                changed = true;
            }

            if (!candidate) {
                changed = true;
                continue;
            }

            if (seen.has(candidate)) {
                changed = true;
                continue;
            }

            seen.add(candidate);
            updated.push(candidate);
        }

        if (updated.length > limit) {
            updated.length = limit;
            changed = true;
        }

        if (!changed) {
            return false;
        }

        this.settingsProvider.settings.recentNotes = updated;
        return true;
    }

    /**
     * Removes entries for deleted files
     * @returns true when the list changed
     */
    removeEntry(path: string): boolean {
        if (!path) {
            return false;
        }

        const current = this.ensureRecentNotes();
        if (current.length === 0) {
            return false;
        }

        const filtered = current.filter(entry => entry !== path);
        if (filtered.length === current.length) {
            return false;
        }

        this.settingsProvider.settings.recentNotes = filtered;
        return true;
    }

    private ensureRecentNotes(): string[] {
        if (!Array.isArray(this.settingsProvider.settings.recentNotes)) {
            this.settingsProvider.settings.recentNotes = [];
        }

        return this.settingsProvider.settings.recentNotes;
    }

    private getLimit(): number {
        const { recentNotesCount } = this.settingsProvider.settings;
        const limit = typeof recentNotesCount === 'number' ? recentNotesCount : RECENT_NOTES_DEFAULT_COUNT;
        return Math.max(1, limit);
    }
}
