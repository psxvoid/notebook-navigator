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

import { App, Platform } from 'obsidian';

/**
 * Mobile logger that writes debug logs to a file in the vault.
 * Useful for debugging on mobile devices where console access is limited.
 */
export class MobileLogger {
    private static instance: MobileLogger;
    private app: App;
    private isInitialized = false;
    private logFileName: string;

    private constructor(app: App) {
        this.app = app;
        // Create a log file with timestamp
        const date = new Date();
        const timestamp = date.toISOString().replace(/:/g, '-').replace(/\./g, '-');
        this.logFileName = `nn-debug-${timestamp}.log`;
    }

    static getInstance(app?: App): MobileLogger {
        if (!MobileLogger.instance && app) {
            MobileLogger.instance = new MobileLogger(app);
        }
        return MobileLogger.instance;
    }

    private async ensureLogFile() {
        if (this.isInitialized) return;

        try {
            // Check if file exists
            const fileExists = await this.app.vault.adapter.exists(this.logFileName);

            if (!fileExists) {
                // Create file with header
                const header = `=== Notebook Navigator Debug Log ===
Created: ${new Date().toISOString()}
Platform: ${Platform.isMobile ? 'Mobile' : 'Desktop'}

`;
                await this.app.vault.create(this.logFileName, header);
            }

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to create log file:', error);
        }
    }

    async log(...args: any[]) {
        // Always log to console as well
        console.log(...args);

        // Only write to file on mobile
        if (!Platform.isMobile) return;

        try {
            await this.ensureLogFile();

            // Format the log entry
            const timestamp = new Date().toISOString();
            const message = args
                .map(arg => {
                    if (typeof arg === 'object') {
                        return JSON.stringify(arg, null, 2);
                    }
                    return String(arg);
                })
                .join(' ');

            const logEntry = `[${timestamp}] ${message}\n`;

            // Append to file
            const currentContent = await this.app.vault.adapter.read(this.logFileName);
            await this.app.vault.adapter.write(this.logFileName, currentContent + logEntry);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    async clear() {
        if (!Platform.isMobile) return;

        try {
            if (await this.app.vault.adapter.exists(this.logFileName)) {
                await this.app.vault.adapter.remove(this.logFileName);
                this.isInitialized = false;
            }
        } catch (error) {
            console.error('Failed to clear log file:', error);
        }
    }
}

// Global logger instance
let globalLogger: MobileLogger | null = null;

/**
 * Initialize the global logger with the app instance.
 * Should be called once when the plugin loads.
 */
export function initializeMobileLogger(app: App) {
    globalLogger = MobileLogger.getInstance(app);
}

/**
 * Log function that uses the global logger.
 * Usage: log('message', { data: 'object' });
 * @knipignore
 */
export function log(...args: any[]) {
    if (globalLogger) {
        globalLogger.log(...args);
    } else {
        // Fallback to console.log if logger not initialized
        console.log('[MobileLogger not initialized]', ...args);
    }
}

/**
 * Clear the log file.
 * @knipignore
 */
export async function clearLog() {
    if (globalLogger) {
        await globalLogger.clear();
    }
}
