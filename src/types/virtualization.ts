import { TFile, TFolder } from 'obsidian';
import { TagTreeNode } from '../utils/tagUtils';

export interface VirtualItem<T> {
  type: string;
  data: T;
  key: string;
  level?: number; // For hierarchical items
}

export interface FileListItem {
  type: 'header' | 'file';
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

export type CombinedLeftPaneItem = 
  | FolderTreeItem
  | { type: 'tag-header'; key: string }
  | TagTreeItem
  | { type: 'untagged'; data: TagTreeNode; key: string }
  | { type: 'spacer'; key: string };