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

// Constants for pane dimensions
const PANE_DIMENSIONS = {
    DEFAULT_WIDTH: 300,
    MIN_WIDTH: 150,
    MAX_WIDTH: 600
};

// Storage keys
const STORAGE_KEYS = {
    LEFT_PANE_WIDTH: 'notebook-navigator-left-pane-width',
    LEFT_PANE_COLLAPSED: 'notebook-navigator-left-pane-collapsed'
};

// State interface
interface UIState {
    focusedPane: 'folders' | 'files';
    currentMobileView: 'list' | 'files';
    paneWidth: number;
    newlyCreatedPath: string | null;
    leftPaneCollapsed: boolean;
}

// Action types
type UIAction = 
    | { type: 'SET_FOCUSED_PANE'; pane: 'folders' | 'files' }
    | { type: 'SET_MOBILE_VIEW'; view: 'list' | 'files' }
    | { type: 'SET_PANE_WIDTH'; width: number }
    | { type: 'SET_NEWLY_CREATED_PATH'; path: string | null }
    | { type: 'TOGGLE_LEFT_PANE' };
    
// Create contexts
const UIStateContext = createContext<UIState | null>(null);
const UIDispatchContext = createContext<React.Dispatch<UIAction> | null>(null);

// Reducer
function uiStateReducer(state: UIState, action: UIAction): UIState {
    switch (action.type) {
        case 'SET_FOCUSED_PANE':
            return { ...state, focusedPane: action.pane };
        
        case 'SET_MOBILE_VIEW':
            return { ...state, currentMobileView: action.view };
        
        case 'SET_PANE_WIDTH':
            return { ...state, paneWidth: action.width };
        
        case 'SET_NEWLY_CREATED_PATH':
            return { ...state, newlyCreatedPath: action.path };
        
        case 'TOGGLE_LEFT_PANE':
            return { ...state, leftPaneCollapsed: !state.leftPaneCollapsed };
        
        default:
            return state;
    }
}

// Provider component
interface UIStateProviderProps {
    children: ReactNode;
    isMobile: boolean;
}

export function UIStateProvider({ children, isMobile }: UIStateProviderProps) {
    // Load initial state
    const loadInitialState = (): UIState => {
        const savedWidth = localStorage.getItem(STORAGE_KEYS.LEFT_PANE_WIDTH);
        const paneWidth = savedWidth ? parseInt(savedWidth) : PANE_DIMENSIONS.DEFAULT_WIDTH;
        
        const savedCollapsed = localStorage.getItem(STORAGE_KEYS.LEFT_PANE_COLLAPSED);
        const leftPaneCollapsed = savedCollapsed === 'true';
        
        const initialState = {
            focusedPane: 'folders' as const,
            currentMobileView: 'list' as const,
            paneWidth: Math.max(PANE_DIMENSIONS.MIN_WIDTH, Math.min(paneWidth, PANE_DIMENSIONS.MAX_WIDTH)),
            newlyCreatedPath: null,
            leftPaneCollapsed
        };
        
        return initialState;
    };
    
    const [state, dispatch] = useReducer(uiStateReducer, undefined, loadInitialState);
    
    // Persist pane width to localStorage
    useEffect(() => {
        if (!isMobile) {
            localStorage.setItem(STORAGE_KEYS.LEFT_PANE_WIDTH, state.paneWidth.toString());
        }
    }, [state.paneWidth, isMobile]);
    
    // Persist collapsed state to localStorage
    useEffect(() => {
        if (!isMobile) {
            localStorage.setItem(STORAGE_KEYS.LEFT_PANE_COLLAPSED, state.leftPaneCollapsed.toString());
        }
    }, [state.leftPaneCollapsed, isMobile]);
    
    return (
        <UIStateContext.Provider value={state}>
            <UIDispatchContext.Provider value={dispatch}>
                {children}
            </UIDispatchContext.Provider>
        </UIStateContext.Provider>
    );
}

// Custom hooks
export function useUIState() {
    const context = useContext(UIStateContext);
    if (!context) {
        throw new Error('useUIState must be used within UIStateProvider');
    }
    return context;
}

export function useUIDispatch() {
    const context = useContext(UIDispatchContext);
    if (!context) {
        throw new Error('useUIDispatch must be used within UIStateProvider');
    }
    return context;
}