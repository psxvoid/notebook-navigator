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

import React, { createContext, useContext, useReducer, ReactNode, useMemo } from 'react';
import { NAVIGATION_PANE_DIMENSIONS } from '../types';
// Storage keys
import { STORAGE_KEYS } from '../types';
import { localStorage } from '../utils/localStorage';

import { useSettingsState } from './SettingsContext';

// State interface
interface UIState {
    focusedPane: 'navigation' | 'files' | 'search';
    currentSinglePaneView: 'navigation' | 'files';
    paneWidth: number;
    dualPane: boolean;
    singlePane: boolean;
}

// Action types
export type UIAction =
    | { type: 'SET_FOCUSED_PANE'; pane: 'navigation' | 'files' | 'search' }
    | { type: 'SET_SINGLE_PANE_VIEW'; view: 'navigation' | 'files' }
    | { type: 'SET_PANE_WIDTH'; width: number };

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
    const loadInitialState = (): UIState => {
        const savedWidth = localStorage.get<number>(STORAGE_KEYS.navigationPaneWidthKey);

        const paneWidth = savedWidth ?? NAVIGATION_PANE_DIMENSIONS.defaultWidth;

        const initialState = {
            focusedPane: 'navigation' as const,
            currentSinglePaneView: 'files' as const,
            paneWidth: Math.max(NAVIGATION_PANE_DIMENSIONS.minWidth, paneWidth),
            dualPane: false, // Will be computed later
            singlePane: false // Will be computed later
        };

        return initialState;
    };

    const [state, dispatch] = useReducer(uiStateReducer, undefined, loadInitialState);
    const settings = useSettingsState();

    // Compute dualPane and singlePane based on isMobile and settings
    const stateWithPaneMode = useMemo(() => {
        const dualPane = !isMobile && settings.dualPane;
        return {
            ...state,
            dualPane,
            singlePane: !dualPane
        };
    }, [state, isMobile, settings.dualPane]);

    // Note: Pane width persistence is handled by useResizablePane hook
    // to avoid duplicate writes during drag operations

    return (
        <UIStateContext.Provider value={stateWithPaneMode}>
            <UIDispatchContext.Provider value={dispatch}>{children}</UIDispatchContext.Provider>
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
