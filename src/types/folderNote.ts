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

export type FolderNoteType = 'markdown' | 'canvas' | 'base';

export type FolderNoteCreationPreference = FolderNoteType | 'ask';

export const FOLDER_NOTE_TYPE_EXTENSIONS: Record<FolderNoteType, string> = {
    markdown: 'md',
    canvas: 'canvas',
    base: 'base'
};

function isFolderNoteType(value: string): value is FolderNoteType {
    return value === 'markdown' || value === 'canvas' || value === 'base';
}

export function isFolderNoteCreationPreference(value: string): value is FolderNoteCreationPreference {
    return value === 'ask' || isFolderNoteType(value);
}
