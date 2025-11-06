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

        if (replacer == null) {
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