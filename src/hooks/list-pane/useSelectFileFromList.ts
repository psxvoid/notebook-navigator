/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad, modifications by Pavel Sapehin
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

import { TFile } from "obsidian";
import { useCallback } from "react";
import { useSelectionDispatch } from "src/context/SelectionContext";
import { useFileOpener } from "../useFileOpener";


/**
 * Options for selecting a file programmatically
 */
export interface SelectFileOptions {
    /** Mark the selection as keyboard navigation to prevent scroll interference */
    markKeyboardNavigation?: boolean;
    /** Mark the selection as user-initiated to track explicit user actions */
    markUserSelection?: boolean;
    /** Skip opening the file after selection */
    suppressOpen?: boolean;
}

export const useSelectFileFromList = (isUserSelectionRef: React.RefObject<boolean>) => {
    const selectionDispatch = useSelectionDispatch();
    const openFileInWorkspace = useFileOpener();

    const selectFileFromList = useCallback(
            (file: TFile, options?: SelectFileOptions) => {
                if (!file) {
                    return;
                }

                // Track whether this selection originated from explicit user interaction
                isUserSelectionRef.current = options?.markUserSelection ?? false;

                // Update the selected file in global state
                selectionDispatch({ type: 'SET_SELECTED_FILE', file });

                // Mark as keyboard-driven to prevent automatic scroll interference
                if (options?.markKeyboardNavigation) {
                    selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                }

                // Open file in the active leaf without moving focus
                if (!options?.suppressOpen) {
                    openFileInWorkspace(file);
                }
            },
            [isUserSelectionRef, selectionDispatch, openFileInWorkspace]
        );

    return { selectFileFromList }
}