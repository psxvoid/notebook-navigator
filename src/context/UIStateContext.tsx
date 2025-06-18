import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Constants for pane dimensions
const PANE_DIMENSIONS = {
    DEFAULT_WIDTH: 300,
    MIN_WIDTH: 150,
    MAX_WIDTH: 600
};

// Storage keys
const STORAGE_KEYS = {
    LEFT_PANE_WIDTH: 'notebook-navigator-left-pane-width'
};

// State interface
interface UIState {
    focusedPane: 'folders' | 'files';
    currentMobileView: 'list' | 'files';
    paneWidth: number;
    scrollToFolderIndex: number | null;
    scrollToFileIndex: number | null;
    activeViewScrollTrigger: number; // New trigger
}

// Action types
type UIAction = 
    | { type: 'SET_FOCUSED_PANE'; pane: 'folders' | 'files' }
    | { type: 'SET_MOBILE_VIEW'; view: 'list' | 'files' }
    | { type: 'SET_PANE_WIDTH'; width: number }
    | { type: 'SCROLL_TO_FOLDER_INDEX'; index: number | null }
    | { type: 'SCROLL_TO_FILE_INDEX'; index: number | null }
    | { type: 'TRIGGER_ACTIVE_VIEW_SCROLL' }; // New action

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
        
        case 'SCROLL_TO_FOLDER_INDEX':
            return { ...state, scrollToFolderIndex: action.index };
        
        case 'SCROLL_TO_FILE_INDEX':
            return { ...state, scrollToFileIndex: action.index };
        
        case 'TRIGGER_ACTIVE_VIEW_SCROLL':
            return { ...state, activeViewScrollTrigger: state.activeViewScrollTrigger + 1 };
        
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
        
        return {
            focusedPane: 'folders',
            currentMobileView: 'list',
            paneWidth: Math.max(PANE_DIMENSIONS.MIN_WIDTH, Math.min(paneWidth, PANE_DIMENSIONS.MAX_WIDTH)),
            scrollToFolderIndex: null,
            scrollToFileIndex: null,
            activeViewScrollTrigger: 0 // New property
        };
    };
    
    const [state, dispatch] = useReducer(uiStateReducer, undefined, loadInitialState);
    
    // Persist pane width to localStorage
    useEffect(() => {
        if (!isMobile) {
            localStorage.setItem(STORAGE_KEYS.LEFT_PANE_WIDTH, state.paneWidth.toString());
        }
    }, [state.paneWidth, isMobile]);
    
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