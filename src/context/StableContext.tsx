import React, { createContext, useContext, ReactNode } from 'react';
import { App } from 'obsidian';
import NotebookNavigator from '../main';

// Context value interface
interface StableContextValue {
    app: App;
    plugin: NotebookNavigator;
    isMobile: boolean;
    refreshCounter: number;
    triggerRefresh: () => void;
}

// Create context
const StableContext = createContext<StableContextValue | null>(null);

// Provider component
interface StableProviderProps {
    children: ReactNode;
    plugin: NotebookNavigator;
    isMobile: boolean;
}

export function StableProvider({ children, plugin, isMobile }: StableProviderProps) {
    const [refreshCounter, setRefreshCounter] = React.useState(0);
    
    const triggerRefresh = React.useCallback(() => {
        setRefreshCounter(prev => prev + 1);
    }, []);
    
    // Create stable context value
    const contextValue = React.useMemo<StableContextValue>(() => ({
        app: plugin.app,
        plugin,
        isMobile,
        refreshCounter,
        triggerRefresh
    }), [plugin, isMobile, refreshCounter, triggerRefresh]);
    
    return (
        <StableContext.Provider value={contextValue}>
            {children}
        </StableContext.Provider>
    );
}

// Custom hook
export function useStableContext() {
    const context = useContext(StableContext);
    if (!context) {
        throw new Error('useStableContext must be used within StableProvider');
    }
    return context;
}