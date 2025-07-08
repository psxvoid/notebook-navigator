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

import { Menu, TFile, TFolder, App } from 'obsidian';
import { ItemType } from '../../types';
import { NotebookNavigatorSettings } from '../../settings';
import { FileSystemOperations } from '../../services/FileSystemService';
import { MetadataService } from '../../services/MetadataService';
import { TagOperations } from '../../services/TagOperations';
import { SelectionState, SelectionAction } from '../../context/SelectionContext';
import { NotebookNavigatorPlugin } from '../../types/plugin';
import { ExpansionAction } from '../../context/ExpansionContext';
import { UIAction } from '../../context/UIStateContext';

/**
 * Configuration for the context menu
 */
export interface MenuConfig {
    /** The type of item this menu is for */
    type: ItemType;
    /** The file, folder, or tag path the menu operates on */
    item: TFile | TFolder | string; // string for tag paths
}

/**
 * Services available to menu builders
 */
export interface MenuServices {
    app: App;
    plugin: NotebookNavigatorPlugin;
    isMobile: boolean;
    fileSystemOps: FileSystemOperations;
    metadataService: MetadataService;
    tagOperations: TagOperations;
}

/**
 * State values available to menu builders
 */
export interface MenuState {
    selectionState: SelectionState;
    expandedFolders: Set<string>;
    expandedTags: Set<string>;
}

/**
 * Dispatch functions available to menu builders
 */
export interface MenuDispatchers {
    selectionDispatch: (action: SelectionAction) => void;
    expansionDispatch: (action: ExpansionAction) => void;
    uiDispatch: (action: UIAction) => void;
}

/**
 * Common parameters for all menu builders
 */
export interface MenuBuilderParams {
    menu: Menu;
    services: MenuServices;
    settings: NotebookNavigatorSettings;
    state: MenuState;
    dispatchers: MenuDispatchers;
}

/**
 * Parameters for folder menu builder
 */
export interface FolderMenuBuilderParams extends MenuBuilderParams {
    folder: TFolder;
}

/**
 * Parameters for tag menu builder
 */
export interface TagMenuBuilderParams extends MenuBuilderParams {
    tagPath: string;
}

/**
 * Parameters for file menu builder
 */
export interface FileMenuBuilderParams extends MenuBuilderParams {
    file: TFile;
}