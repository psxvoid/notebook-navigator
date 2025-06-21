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

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { TFolder } from 'obsidian';

// Storage keys
const STORAGE_KEYS = {
    EXPANDED_FOLDERS: 'notebook-navigator-expanded-folders',
    EXPANDED_TAGS: 'notebook-navigator-expanded-tags'
};

// State interface
interface ExpansionState {
    expandedFolders: Set<string>;
    expandedTags: Set<string>;
}

// Action types
type ExpansionAction = 
    | { type: 'SET_EXPANDED_FOLDERS'; folders: Set<string> }
    | { type: 'SET_EXPANDED_TAGS'; tags: Set<string> }
    | { type: 'TOGGLE_FOLDER_EXPANDED'; folderPath: string }
    | { type: 'TOGGLE_TAG_EXPANDED'; tagPath: string }
    | { type: 'EXPAND_FOLDERS'; folderPaths: string[] }
    | { type: 'CLEANUP_DELETED_FOLDERS'; existingPaths: Set<string> }
    | { type: 'CLEANUP_DELETED_TAGS'; existingTags: Set<string> };

// Create contexts
const ExpansionContext = createContext<ExpansionState | null>(null);
const ExpansionDispatchContext = createContext<React.Dispatch<ExpansionAction> | null>(null);

// Reducer
function expansionReducer(state: ExpansionState, action: ExpansionAction): ExpansionState {
    switch (action.type) {
        case 'SET_EXPANDED_FOLDERS':
            return { ...state, expandedFolders: action.folders };
        
        case 'SET_EXPANDED_TAGS':
            return { ...state, expandedTags: action.tags };
        
        case 'TOGGLE_FOLDER_EXPANDED': {
            const newExpanded = new Set(state.expandedFolders);
            if (newExpanded.has(action.folderPath)) {
                newExpanded.delete(action.folderPath);
            } else {
                newExpanded.add(action.folderPath);
            }
            return { ...state, expandedFolders: newExpanded };
        }
        
        case 'TOGGLE_TAG_EXPANDED': {
            const newExpanded = new Set(state.expandedTags);
            if (newExpanded.has(action.tagPath)) {
                newExpanded.delete(action.tagPath);
            } else {
                newExpanded.add(action.tagPath);
            }
            return { ...state, expandedTags: newExpanded };
        }
        
        case 'EXPAND_FOLDERS': {
            const newExpanded = new Set(state.expandedFolders);
            action.folderPaths.forEach(path => newExpanded.add(path));
            return { ...state, expandedFolders: newExpanded };
        }
        
        case 'CLEANUP_DELETED_FOLDERS': {
            const cleaned = new Set(
                Array.from(state.expandedFolders).filter(path => action.existingPaths.has(path))
            );
            return { ...state, expandedFolders: cleaned };
        }
        
        case 'CLEANUP_DELETED_TAGS': {
            const cleaned = new Set(
                Array.from(state.expandedTags).filter(tag => action.existingTags.has(tag))
            );
            return { ...state, expandedTags: cleaned };
        }
        
        default:
            return state;
    }
}

// Provider component
interface ExpansionProviderProps {
    children: ReactNode;
}

export function ExpansionProvider({ children }: ExpansionProviderProps) {
    // Load initial state from localStorage
    const loadInitialState = (): ExpansionState => {
        const expandedFoldersData = localStorage.getItem(STORAGE_KEYS.EXPANDED_FOLDERS);
        const expandedTagsData = localStorage.getItem(STORAGE_KEYS.EXPANDED_TAGS);
        
        const initialState = {
            expandedFolders: new Set<string>(expandedFoldersData ? JSON.parse(expandedFoldersData) : []),
            expandedTags: new Set<string>(expandedTagsData ? JSON.parse(expandedTagsData) : [])
        };
        
        return initialState;
    };
    
    const [state, dispatch] = useReducer(expansionReducer, undefined, loadInitialState);
    
    
    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem(
            STORAGE_KEYS.EXPANDED_FOLDERS, 
            JSON.stringify(Array.from(state.expandedFolders))
        );
    }, [state.expandedFolders]);
    
    useEffect(() => {
        localStorage.setItem(
            STORAGE_KEYS.EXPANDED_TAGS,
            JSON.stringify(Array.from(state.expandedTags))
        );
    }, [state.expandedTags]);
    
    return (
        <ExpansionContext.Provider value={state}>
            <ExpansionDispatchContext.Provider value={dispatch}>
                {children}
            </ExpansionDispatchContext.Provider>
        </ExpansionContext.Provider>
    );
}

// Custom hooks
export function useExpansionState() {
    const context = useContext(ExpansionContext);
    if (!context) {
        throw new Error('useExpansionState must be used within ExpansionProvider');
    }
    return context;
}

export function useExpansionDispatch() {
    const context = useContext(ExpansionDispatchContext);
    if (!context) {
        throw new Error('useExpansionDispatch must be used within ExpansionProvider');
    }
    return context;
}

// Helper functions for common operations
export function getParentFolderPaths(folder: TFolder): string[] {
    const paths: string[] = [];
    let current = folder.parent;
    while (current) {
        paths.push(current.path);
        current = current.parent;
    }
    return paths.reverse();
}