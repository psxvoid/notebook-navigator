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

import { App, TFile, TFolder } from 'obsidian';

/**
 * Types of operations that can be tracked by the command queue
 */
export enum OperationType {
    MOVE_FILE = 'move-file',
    OPEN_FOLDER_NOTE = 'open-folder-note',
    OPEN_VERSION_HISTORY = 'open-version-history'
}

/**
 * Base interface for all operations
 */
interface BaseOperation {
    id: string;
    type: OperationType;
    timestamp: number;
}

/**
 * Operation for tracking file moves
 */
interface MoveFileOperation extends BaseOperation {
    type: OperationType.MOVE_FILE;
    files: TFile[];
    targetFolder: TFolder;
}

/**
 * Operation for tracking folder note opening
 */
interface OpenFolderNoteOperation extends BaseOperation {
    type: OperationType.OPEN_FOLDER_NOTE;
    folderPath: string;
}

/**
 * Operation for tracking version history opening
 */
interface OpenVersionHistoryOperation extends BaseOperation {
    type: OperationType.OPEN_VERSION_HISTORY;
    file: TFile;
}

type Operation = MoveFileOperation | OpenFolderNoteOperation | OpenVersionHistoryOperation;

/**
 * Result of a command execution
 */
export interface CommandResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: Error;
}

/**
 * Service for managing operations and their context, replacing global window flags.
 * This provides a centralized, encapsulated way to track ongoing operations
 * and coordinate between the React UI and Obsidian's event system.
 */
export class CommandQueueService {
    private activeOperations = new Map<string, Operation>();
    private operationCounter = 0;

    constructor(private app: App) {}

    /**
     * Generate a unique operation ID
     */
    private generateOperationId(): string {
        return `op-${Date.now()}-${++this.operationCounter}`;
    }

    /**
     * Check if there's an active operation of a specific type
     */
    hasActiveOperation(type: OperationType): boolean {
        for (const operation of this.activeOperations.values()) {
            if (operation.type === type) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a specific file move operation is active
     */
    isMovingFile(): boolean {
        return this.hasActiveOperation(OperationType.MOVE_FILE);
    }

    /**
     * Check if opening a folder note
     */
    isOpeningFolderNote(): boolean {
        return this.hasActiveOperation(OperationType.OPEN_FOLDER_NOTE);
    }

    /**
     * Check if opening version history
     */
    isOpeningVersionHistory(): boolean {
        return this.hasActiveOperation(OperationType.OPEN_VERSION_HISTORY);
    }

    /**
     * Execute a file move operation with proper context tracking
     */
    async executeMoveFiles(files: TFile[], targetFolder: TFolder): Promise<CommandResult<{ movedCount: number; skippedCount: number }>> {
        const operationId = this.generateOperationId();
        const operation: MoveFileOperation = {
            id: operationId,
            type: OperationType.MOVE_FILE,
            timestamp: Date.now(),
            files,
            targetFolder
        };

        this.activeOperations.set(operationId, operation);

        try {
            let movedCount = 0;
            let skippedCount = 0;

            for (const file of files) {
                const newPath = `${targetFolder.path}/${file.name}`;

                // Check for name conflicts
                if (this.app.vault.getAbstractFileByPath(newPath)) {
                    skippedCount++;
                    continue;
                }

                try {
                    await this.app.fileManager.renameFile(file, newPath);
                    movedCount++;
                } catch (error) {
                    console.error('Error moving file:', file.path, error);
                    throw error;
                }
            }

            return {
                success: true,
                data: { movedCount, skippedCount }
            };
        } catch (error) {
            return {
                success: false,
                error: error as Error
            };
        } finally {
            // Always clean up the operation
            this.activeOperations.delete(operationId);
        }
    }

    /**
     * Execute opening a folder note with context tracking
     */
    async executeOpenFolderNote(folderPath: string, openFile: () => Promise<void>): Promise<CommandResult> {
        const operationId = this.generateOperationId();
        const operation: OpenFolderNoteOperation = {
            id: operationId,
            type: OperationType.OPEN_FOLDER_NOTE,
            timestamp: Date.now(),
            folderPath
        };

        this.activeOperations.set(operationId, operation);

        try {
            await openFile();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error as Error
            };
        } finally {
            // Clean up after a short delay to ensure event handlers see the flag
            setTimeout(() => {
                this.activeOperations.delete(operationId);
            }, 100);
        }
    }

    /**
     * Execute opening version history with context tracking
     */
    async executeOpenVersionHistory(file: TFile, openHistory: () => Promise<void>): Promise<CommandResult> {
        const operationId = this.generateOperationId();
        const operation: OpenVersionHistoryOperation = {
            id: operationId,
            type: OperationType.OPEN_VERSION_HISTORY,
            timestamp: Date.now(),
            file
        };

        this.activeOperations.set(operationId, operation);

        try {
            await openHistory();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error as Error
            };
        } finally {
            // Clean up after a delay
            setTimeout(() => {
                this.activeOperations.delete(operationId);
            }, 100);
        }
    }

    /**
     * Get all active operations (for debugging)
     */
    getActiveOperations(): Operation[] {
        return Array.from(this.activeOperations.values());
    }

    /**
     * Clear all operations (useful for cleanup)
     */
    clearAllOperations(): void {
        this.activeOperations.clear();
    }
}
