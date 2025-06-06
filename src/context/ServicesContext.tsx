// src/context/ServicesContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { App } from 'obsidian';
import { FileSystemOperations } from '../services/FileSystemService';

// Define the shape of our services
interface Services {
    fileSystemOps: FileSystemOperations;
}

// Create the context
const ServicesContext = createContext<Services>(null!);

// Provider component
export function ServicesProvider({ children, app }: { children: React.ReactNode, app: App }) {
    // Instantiate services
    const services = useMemo(() => ({
        fileSystemOps: new FileSystemOperations(app)
    }), [app]);

    return (
        <ServicesContext.Provider value={services}>
            {children}
        </ServicesContext.Provider>
    );
}

// Hook to use services
export function useServices() {
    return useContext(ServicesContext);
}

// Hook to get specific service
export function useFileSystemOps() {
    const { fileSystemOps } = useServices();
    return fileSystemOps;
}