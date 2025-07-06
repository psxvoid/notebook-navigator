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
import { TagTreeNode } from '../utils/tagUtils';
import { ItemType, FileListItemType, NavigationPaneItemType, VirtualFolder } from '../types';

export interface VirtualItem<T> {
  type: string;
  data: T;
  key: string;
  level?: number; // For hierarchical items
}

export interface FileListItem {
  type: FileListItemType;
  data: TFile | string; // File or header text
  parentFolder?: string | null;
  key: string;
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
  | { type: typeof NavigationPaneItemType.UNTAGGED; data: TagTreeNode; key: string; level?: number }
  | { type: typeof NavigationPaneItemType.SPACER; key: string };