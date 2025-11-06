import { EMPTY_STRING } from "src/utils/empty"

export interface TitleReplacer {
    regex: RegExp,
    isGlobal: boolean
}

const supportedFlags = new Set<string>(['g', 'i', 'm', 's', 'u', 'v', 'y'])

export function parseReplacer(source: string): TitleReplacer {
    const flagMatches = /(.*?)(\/.*)$/.exec(source)

    if (flagMatches != null && flagMatches.length > 1) {
        const patternPart = flagMatches[1]
        const flags = [...flagMatches[2]]
            .filter((v, i, arr) => supportedFlags.has(v) && arr.indexOf(v) === i)
            .join(EMPTY_STRING)
        return { regex: new RegExp(patternPart, flags), isGlobal: flags.contains('g') }
    }

    return { regex: new RegExp(source), isGlobal: false }
}