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

import { TFile } from 'obsidian';

/**
 * State for managing auto-reveal behavior
 */
export interface AutoRevealState {
    status: 'IDLE' | 'USER_INTERACTING' | 'AUTO_REVEALING' | 'DELETING';
    lastInteractionTime: number;
    revealedFiles: Set<string>;
    deletingFile: boolean;
}

/**
 * Actions for the auto-reveal state machine
 */
export type AutoRevealAction =
    | { type: 'USER_INTERACTION' }
    | { type: 'FILE_DELETE_START' }
    | { type: 'FILE_DELETE_END' }
    | { type: 'REVEAL_FILE_START'; file: TFile }
    | { type: 'REVEAL_FILE_END'; filePath: string }
    | { type: 'CLEAR_REVEALED_FILE'; filePath: string }
    | { type: 'RESET_TO_IDLE' };

/**
 * Initial state for the auto-reveal state machine
 */
export const initialAutoRevealState: AutoRevealState = {
    status: 'IDLE',
    lastInteractionTime: 0,
    revealedFiles: new Set<string>(),
    deletingFile: false
};

/**
 * Reducer for managing auto-reveal state transitions
 */
export function autoRevealReducer(state: AutoRevealState, action: AutoRevealAction): AutoRevealState {
    switch (action.type) {
        case 'USER_INTERACTION':
            return {
                ...state,
                status: 'USER_INTERACTING',
                lastInteractionTime: Date.now()
            };

        case 'FILE_DELETE_START':
            return {
                ...state,
                status: 'DELETING',
                deletingFile: true
            };

        case 'FILE_DELETE_END':
            return {
                ...state,
                status: 'IDLE',
                deletingFile: false
            };

        case 'REVEAL_FILE_START':
            return {
                ...state,
                status: 'AUTO_REVEALING',
                revealedFiles: new Set([...state.revealedFiles, action.file.path])
            };

        case 'REVEAL_FILE_END':
            return {
                ...state,
                status: 'IDLE'
            };

        case 'CLEAR_REVEALED_FILE':
            const updatedFiles = new Set(state.revealedFiles);
            updatedFiles.delete(action.filePath);
            return {
                ...state,
                revealedFiles: updatedFiles
            };

        case 'RESET_TO_IDLE':
            return {
                ...state,
                status: 'IDLE'
            };

        default:
            return state;
    }
}

/**
 * Helper to determine if auto-reveal should be allowed
 */
export function shouldAutoReveal(
    state: AutoRevealState,
    isNewlyCreatedFile: boolean,
    interactionThreshold: number = 300
): boolean {
    const timeSinceInteraction = Date.now() - state.lastInteractionTime;
    
    // Always allow reveal for newly created files
    if (isNewlyCreatedFile) {
        return true;
    }
    
    // Allow reveal during deletion
    if (state.status === 'DELETING') {
        return true;
    }
    
    // Don't reveal if user recently interacted with navigator
    if (state.status === 'USER_INTERACTING' && timeSinceInteraction < interactionThreshold) {
        return false;
    }
    
    // Otherwise allow reveal
    return true;
}