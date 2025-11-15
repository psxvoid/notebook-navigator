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

import { NotebookNavigatorSettings } from "src/settings"
import { parseReplacer, TextReplacer } from "./TextReplacer"

const replacerCache = new Map<string, TextReplacer>()

export function transformTitle<T extends string | undefined | null>(sourceTitle: T, settings: NotebookNavigatorSettings): T {
    return transformWith(sourceTitle, settings.noteTitleTransform)
}

export function transformPreview<T extends string | undefined | null>(sourceTitle: T, settings: NotebookNavigatorSettings): T {
    return transformWith(sourceTitle, settings.notePreviewTransform)
}

export interface PatternReplaceSource {
    pattern: string,
    replacement: string,
}

function transformWith<T extends string | undefined | null>(sourceTitle: T, sources: readonly PatternReplaceSource[]): T {
    if (sourceTitle == null || sources.length === 0) {
        return sourceTitle
    }

    for (const { pattern, replacement } of sources) {
        let replacer = replacerCache.get(pattern)

        if (replacer == null || replacer.replacement !== replacement) {
            const newReplacer = parseReplacer(pattern, replacement)

            replacerCache.set(pattern, newReplacer)

            replacer = newReplacer
        }

        const transformedTitle = replacer.replace(sourceTitle)

        if (transformedTitle == null || transformedTitle.length === 0) {
            continue
        }

        if (sourceTitle != null && transformedTitle.length !== sourceTitle.length || transformedTitle !== sourceTitle) {
            sourceTitle = transformedTitle as T
        }
    }

    return sourceTitle
}