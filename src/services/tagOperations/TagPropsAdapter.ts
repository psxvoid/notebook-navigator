/*
 * Notebook Navigator Ex - Plugin for Obsidian
 * Copyright (c) 2025 Pavel Sapehin
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

import { NotebookNavigatorSettings } from "../../settings";
import { mergeTags, TagsV2 } from "../../storage/IndexedDBStorage";
import { getActiveMainTagFrontmatterProp, getActiveTagProps } from "../../utils/vaultProfiles";
import { EMPTY_ARRAY } from "../../utils/empty";

export function getActiveTags(tags: TagsV2, settings: NotebookNavigatorSettings): readonly string[] {
    const tagProps = getActiveTagProps(settings)

    return mergeTags(tags, tagProps)
}

export function getMainTagsFromFrontmatter(fm: Record<string, unknown>, settings: NotebookNavigatorSettings): readonly string[] {
    const fmProp = getActiveMainTagFrontmatterProp(settings)

    return Reflect.has(fm, fmProp)
        && Array.isArray(fm[fmProp])
        && fm[fmProp].length > 0
            ? fm[fmProp] as readonly string[]
            : EMPTY_ARRAY
}