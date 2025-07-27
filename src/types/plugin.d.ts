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

import { Plugin, App, TFile } from 'obsidian';
import { MetadataService } from '../services/MetadataService';
import { NotebookNavigatorSettings } from '../settings';
import { NotebookNavigatorView } from '../view/NotebookNavigatorView';

/**
 * Type definition for the Notebook Navigator plugin instance
 */
export interface NotebookNavigatorPlugin extends Plugin {
    app: App;
    settings: NotebookNavigatorSettings;
    metadataService: MetadataService | null;
    navigatorView?: NotebookNavigatorView;

    // Methods
    saveSettings(): Promise<void>;
    onSettingsUpdate(): void;
    loadSettings(): Promise<void>;
    registerFileRenameListener(id: string, callback: (oldPath: string, newPath: string) => void): void;
    unregisterFileRenameListener(id: string): void;
    navigateToFile(file: TFile): Promise<void>;
}

/**
 * Simple window extensions for plugin state
 */
export interface PluginWindow extends Window {
    notebookNavigatorOpeningVersionHistory?: boolean;
    notebookNavigatorOpeningFolderNote?: boolean;
    notebookNavigatorMovingFile?: boolean;
}

// Extend the global Window interface
declare global {
    interface Window {
        notebookNavigatorOpeningVersionHistory?: boolean;
        notebookNavigatorOpeningFolderNote?: boolean;
        notebookNavigatorMovingFile?: boolean;
    }
}
