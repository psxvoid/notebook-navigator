import { EMPTY_STRING } from "src/utils/empty"

export interface TextReplacer {
    replace<T extends string | null | undefined>(text: T): T
}

const supportedFlags = new Set<string>(['g', 'i', 'm', 's', 'u', 'v', 'y'])

const IsReplaceAllSupported =
    // @ts-ignore
    typeof String.prototype.replaceAll === 'function'

class RegExpReplacer implements TextReplacer {
    constructor(
        private readonly regex: RegExp,
        private readonly isGlobal: boolean,
        private readonly replacement: string,
    ) {
    }

    public replace<T extends string | null | undefined>(text: T): T {
        if (text == null) {
            return text;
        }

        if (!this.isGlobal) {
            return text.replace(this.regex, this.replacement) as T
        }

        return IsReplaceAllSupported
            // @ts-ignore
            ? text.replaceAll(this.regex, this.replacement)
            : text.replace(this.regex, this.replacement) as T
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