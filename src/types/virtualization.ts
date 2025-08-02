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

import { TFile, TFolder } from 'obsidian';
import { ListPaneItemType, NavigationPaneItemType, VirtualFolder } from '../types';
import { TagTreeNode } from '../types/storage';

export interface VirtualItem<T> {
    type: string;
    data: T;
    key: string;
    level?: number; // For hierarchical items
}

export interface ListPaneItem {
    type: ListPaneItemType;
    data: TFile | string; // File or header text
    parentFolder?: string | null;
    key: string;
    // Pre-computed metadata for performance optimization
    metadata?: {
        hasTags?: boolean;
        hasPreview?: boolean;
        isInSubfolder?: boolean;
    };
}

export interface FolderTreeItem {
    type: typeof NavigationPaneItemType.FOLDER;
    data: TFolder;
    level: number;
    path: string;
    key: string;
}

export interface TagTreeItem {
    type: typeof NavigationPaneItemType.TAG;
    data: TagTreeNode;
    level: number;
    path?: string;
    key: string;
    context?: 'favorites' | 'tags'; // Indicates which section this tag is in
}

export interface UntaggedItem {
    type: typeof NavigationPaneItemType.UNTAGGED;
    data: TagTreeNode;
    level: number;
    key: string;
    context?: 'favorites' | 'tags'; // Indicates which section this item is in
}

export interface VirtualFolderItem {
    type: typeof NavigationPaneItemType.VIRTUAL_FOLDER;
    data: VirtualFolder;
    level: number;
    key: string;
}

export type CombinedNavigationItem =
    | FolderTreeItem
    | VirtualFolderItem
    | TagTreeItem
    | UntaggedItem
    | { type: typeof NavigationPaneItemType.SPACER; key: string }
    | { type: typeof NavigationPaneItemType.LIST_SPACER; key: string };
