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
import { ListPaneItem } from "src/types/virtualization";
import { ListPaneItemType } from "src/types";

export type onSelectFileCallback = (file: TFile, options?: { markKeyboardNavigation?: boolean }) => void;

export const useSelectItemAtIndex = (onSelectFile: onSelectFileCallback) => {

    const selectItemAtIndex = useCallback(
        (item: ListPaneItem, markKeyboardNavigation: boolean = true) => {
            if (item.type === ListPaneItemType.FILE) {
                const file = item.data instanceof TFile ? item.data : null;
                if (!file) return;

                onSelectFile(file, { markKeyboardNavigation });
            }
        },
        [onSelectFile]
    );

    return { selectItemAtIndex }
}