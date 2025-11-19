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
import { useServices } from "src/context/ServicesContext";
import { ListPaneItemType } from "src/types";
import { ListPaneItem } from "src/types/virtualization";

export const useSelectItemAtIndex = () => {
    const selectionDispatch = useSelectionDispatch();
    const { app, commandQueue } = useServices();

    const selectItemAtIndex = useCallback(
        (item: ListPaneItem, isKeyboardNavigation: boolean = true) => {
            if (item.type === ListPaneItemType.FILE) {
                const file = item.data instanceof TFile ? item.data : null;
                if (!file) return;

                // Normal navigation clears multi-selection
                selectionDispatch({ type: 'SET_SELECTED_FILE', file });

                // Mark as keyboard navigation to prevent auto-scrolling on rapid navigation
                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation });

                // Open the file in the editor without moving focus
                const openFile = async () => {
                    const leaf = app.workspace.getLeaf(false);
                    if (!leaf) {
                        return;
                    }
                    await leaf.openFile(file, { active: false });
                };

                // Queue the file open if command queue is available
                if (commandQueue) {
                    void commandQueue.executeOpenActiveFile(file, openFile);
                } else {
                    void openFile();
                }
            }
        },
        [selectionDispatch, app.workspace, commandQueue]
    );

    return { selectItemAtIndex }
}