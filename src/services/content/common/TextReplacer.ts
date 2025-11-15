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

import { EMPTY_STRING } from "src/utils/empty"

export interface TextReplacer {
    replace<T extends string | null | undefined>(text: T): T
    readonly replacement: string
}

const supportedFlags = new Set<string>(['g', 'i', 'm', 's', 'u', 'v', 'y'])

const IsReplaceAllSupported =
    // @ts-ignore
    typeof String.prototype.replaceAll === 'function'

class RegExpReplacer implements TextReplacer {
    constructor(
        private readonly regex: RegExp,
        private readonly isGlobal: boolean,
        private readonly currentReplacement: string,
    ) {
    }

    public replace<T extends string | null | undefined>(text: T): T {
        if (text == null) {
            return text;
        }

        if (!this.isGlobal) {
            return text.replace(this.regex, this.currentReplacement) as T
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return IsReplaceAllSupported
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            ? text.replaceAll(this.regex, this.currentReplacement)
            : text.replace(this.regex, this.currentReplacement) as T
    }

    public get replacement(): string {
        return this.currentReplacement
    }
}

export function parseReplacer(source: string, replacement: string): TextReplacer {
    const flagMatches = /(.*?)(\/.*)$/.exec(source)

    if (flagMatches != null && flagMatches.length > 1) {
        const patternPart = flagMatches[1]
        const flags = [...flagMatches[2]]
            .filter((v, i, arr) => supportedFlags.has(v) && arr.indexOf(v) === i)
            .join(EMPTY_STRING)
        return new RegExpReplacer(new RegExp(patternPart, flags), flags.contains('g'), replacement)
    }

    return new RegExpReplacer(new RegExp(source), false, replacement)
}