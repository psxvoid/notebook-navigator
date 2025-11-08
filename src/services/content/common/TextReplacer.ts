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