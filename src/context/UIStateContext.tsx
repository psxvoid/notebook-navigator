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

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useMemo } from 'react';
import { NAVIGATION_PANE_DIMENSIONS } from '../types';
import { localStorage } from '../utils/localStorage';
import { useSettings } from './SettingsContext';

// Storage keys
import { STORAGE_KEYS } from '../types';

// State interface
interface UIState {
    focusedPane: 'folders' | 'files';
    currentSinglePaneView: 'list' | 'files';
    paneWidth: number;
    newlyCreatedPath: string | null;
    navigationPaneCollapsed: boolean;
    singlePane: boolean;
}

// Action types
export type UIAction = 
    | { type: 'SET_FOCUSED_PANE'; pane: 'folders' | 'files' }
    | { type: 'SET_SINGLE_PANE_VIEW'; view: 'list' | 'files' }
    | { type: 'SET_PANE_WIDTH'; width: number }
    | { type: 'SET_NEWLY_CREATED_PATH'; path: string | null }
    | { type: 'TOGGLE_NAVIGATION_PANE' };
    
// Create contexts
const UIStateContext = createContext<UIState | null>(null);
const UIDispatchContext = createContext<React.Dispatch<UIAction> | null>(null);

// Reducer
function uiStateReducer(state: UIState, action: UIAction): UIState {
    switch (action.type) {
        case 'SET_FOCUSED_PANE':
            return { ...state, focusedPane: action.pane };
        
        case 'SET_SINGLE_PANE_VIEW':
            return { ...state, currentSinglePaneView: action.view };
        
        case 'SET_PANE_WIDTH':
            return { ...state, paneWidth: action.width };
        
        case 'SET_NEWLY_CREATED_PATH':
            return { ...state, newlyCreatedPath: action.path };
        
        case 'TOGGLE_NAVIGATION_PANE':
            return { ...state, navigationPaneCollapsed: !state.navigationPaneCollapsed };
        
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
        const savedWidth = localStorage.get<number>(STORAGE_KEYS.navigationPaneWidthKey);
        const savedCollapsed = localStorage.get<boolean>(STORAGE_KEYS.navigationPaneCollapsedKey);
        
        const paneWidth = savedWidth ?? NAVIGATION_PANE_DIMENSIONS.defaultWidth;
        const navigationPaneCollapsed = savedCollapsed ?? false;
        
        const initialState = {
            focusedPane: 'folders' as const,
            currentSinglePaneView: 'files' as const,
            paneWidth: Math.max(NAVIGATION_PANE_DIMENSIONS.minWidth, Math.min(paneWidth, NAVIGATION_PANE_DIMENSIONS.maxWidth)),
            newlyCreatedPath: null,
            navigationPaneCollapsed,
            singlePane: false // Will be computed later
        };
        
        return initialState;
    };
    
    const [state, dispatch] = useReducer(uiStateReducer, undefined, loadInitialState);
    const { settings } = useSettings();
    
    // Compute singlePane based on isMobile and settings
    const stateWithSinglePane = useMemo(() => ({
        ...state,
        singlePane: isMobile || settings.singlePane
    }), [state, isMobile, settings.singlePane]);
    
    // Persist pane width to localStorage
    useEffect(() => {
        if (!isMobile) {
            localStorage.set(
                STORAGE_KEYS.navigationPaneWidthKey,
                state.paneWidth
            );
        }
    }, [state.paneWidth, isMobile]);
    
    // Persist collapsed state to localStorage
    useEffect(() => {
        if (!isMobile) {
            localStorage.set(
                STORAGE_KEYS.navigationPaneCollapsedKey,
                state.navigationPaneCollapsed
            );
        }
    }, [state.navigationPaneCollapsed, isMobile]);
    
    return (
        <UIStateContext.Provider value={stateWithSinglePane}>
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