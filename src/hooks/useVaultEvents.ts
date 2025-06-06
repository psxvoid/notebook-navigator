// src/hooks/useVaultEvents.ts
import { useEffect } from 'react';
import { TAbstractFile } from 'obsidian';
import { useAppContext } from '../context/AppContext';

// This hook takes a callback function to run when a vault event occurs
export function useVaultEvents(onVaultChange: () => void) {
    const { app } = useAppContext();

    useEffect(() => {
        // Register all the events
        app.vault.on('create', onVaultChange);
        app.vault.on('delete', onVaultChange);
        app.vault.on('rename', onVaultChange);
        app.vault.on('modify', onVaultChange);

        // Return a cleanup function that runs when the component unmounts
        return () => {
            app.vault.off('create', onVaultChange);
            app.vault.off('delete', onVaultChange);
            app.vault.off('rename', onVaultChange);
            app.vault.off('modify', onVaultChange);
        };
    }, [app, onVaultChange]); // Dependencies array ensures this only runs once
}