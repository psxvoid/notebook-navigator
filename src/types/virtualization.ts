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

export interface VirtualItem<T> {
  type: string;
  data: T;
  key: string;
  level?: number; // For hierarchical items
}

export interface FileListItem {
  type: 'header' | 'file' | 'spacer';
  data: TFile | string; // File or header text
  parentFolder?: string | null;
  key: string;
}

export interface FolderTreeItem {
  type: 'folder';
  data: TFolder;
  level: number;
  path: string;
  key: string;
}

export interface TagTreeItem {
  type: 'tag' | 'tag-header';
  data: TagTreeNode | string;
  level: number;
  path?: string;
  key: string;
}

export type CombinedNavigationItem = 
  | FolderTreeItem
  | { type: 'tag-header'; key: string }
  | TagTreeItem
  | { type: 'untagged'; data: TagTreeNode; key: string }
  | { type: 'spacer'; key: string };