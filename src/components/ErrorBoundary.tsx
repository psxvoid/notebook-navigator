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

import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    componentName?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    errorCount: number;
}

/**
 * Error boundary component to catch and log errors in virtualized lists.
 * Prevents the entire plugin from crashing if there's an error in rendering.
 * Automatically retries rendering after a short delay.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    private retryTimeoutId: number | null = null;

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, errorCount: 0 };
    }

    static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
        // Update state to mark that an error occurred
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        const componentName = this.props.componentName || 'NotebookNavigator';
        
        // Log detailed error information to console
        console.error(`[${componentName}] Component crashed:`, error);
        console.error(`[${componentName}] Component stack:`, errorInfo.componentStack);
        console.error(`[${componentName}] Error stack:`, error.stack);
        
        // Increment error count
        this.setState(prevState => ({ errorCount: prevState.errorCount + 1 }));
        
        // Auto-retry after a delay (unless we've retried too many times)
        if (this.state.errorCount < 3) {
            console.warn(`[${componentName}] Will retry rendering in 100ms (attempt ${this.state.errorCount + 1}/3)`);
            
            if (this.retryTimeoutId) {
                clearTimeout(this.retryTimeoutId);
            }
            
            this.retryTimeoutId = window.setTimeout(() => {
                this.setState({ hasError: false });
                this.retryTimeoutId = null;
            }, 100);
        } else {
            console.error(`[${componentName}] Maximum retry attempts reached. Component will not render.`);
            console.error(`[${componentName}] To debug: Open Developer Console (Ctrl/Cmd+Shift+I) and check the errors above.`);
        }
    }

    componentWillUnmount() {
        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
        }
    }

    render() {
        if (this.state.hasError && this.state.errorCount >= 3) {
            // After 3 failed attempts, render nothing (fail silently)
            return null;
        }

        return this.props.children;
    }
}