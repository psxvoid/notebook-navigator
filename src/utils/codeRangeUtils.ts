import { mergeRanges, NumericRange } from './arrayUtils';

/**
 * Finds fenced code block ranges (```...``` or ~~~...~~~) in the provided content.
 */
export function findFencedCodeBlockRanges(content: string): NumericRange[] {
    const ranges: NumericRange[] = [];
    const fencePattern = /^(\s*)([`~]{3,}).*$/u;
    let index = 0;
    let fenceStart: number | null = null;
    let fenceLength = 0;
    let fenceChar: string | null = null;

    while (index < content.length) {
        const lineEnd = content.indexOf('\n', index);
        const line = lineEnd === -1 ? content.slice(index) : content.slice(index, lineEnd);
        const match = line.match(fencePattern);

        if (fenceStart === null) {
            if (match && match[2]) {
                fenceStart = index;
                fenceLength = match[2].length;
                fenceChar = match[2][0] ?? null;
            }
        } else if (match && match[2]) {
            const matchChar = match[2][0] ?? null;
            if (matchChar === fenceChar && match[2].length >= fenceLength) {
                const blockEnd = lineEnd === -1 ? content.length : lineEnd + 1;
                ranges.push({
                    start: fenceStart,
                    end: blockEnd
                });
                fenceStart = null;
                fenceLength = 0;
                fenceChar = null;
            }
        }

        if (lineEnd === -1) {
            break;
        }
        index = lineEnd + 1;
    }

    if (fenceStart !== null) {
        ranges.push({
            start: fenceStart,
            end: content.length
        });
    }

    return ranges;
}

/**
 * Finds the range containing the provided index within sorted ranges.
 */
export function findRangeContainingIndex(index: number, ranges: readonly NumericRange[]): NumericRange | null {
    let left = 0;
    let right = ranges.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const range = ranges[mid];
        if (index < range.start) {
            right = mid - 1;
        } else if (index >= range.end) {
            left = mid + 1;
        } else {
            return range;
        }
    }

    return null;
}

/** Locates the closing backtick sequence matching the opener's length, skipping excluded ranges */
function findClosingBacktick(content: string, startIndex: number, tickCount: number, excluded: readonly NumericRange[]): number {
    let searchIndex = startIndex;

    while (searchIndex < content.length) {
        const nextBacktick = content.indexOf('`', searchIndex);
        if (nextBacktick === -1) {
            return -1;
        }

        const containing = findRangeContainingIndex(nextBacktick, excluded);
        if (containing) {
            searchIndex = containing.end;
            continue;
        }

        let runLength = 1;
        while (nextBacktick + runLength < content.length && content[nextBacktick + runLength] === '`') {
            runLength += 1;
        }

        if (runLength === tickCount) {
            return nextBacktick;
        }

        searchIndex = nextBacktick + runLength;
    }

    return -1;
}

/**
 * Finds inline code ranges, respecting backtick sequence lengths and excluding nested ranges.
 */
export function findInlineCodeRanges(content: string, excluded: readonly NumericRange[] = []): NumericRange[] {
    const ranges: NumericRange[] = [];
    const mergedExcluded = mergeRanges([...excluded]);
    let searchIndex = 0;

    while (searchIndex < content.length) {
        const nextBacktick = content.indexOf('`', searchIndex);
        if (nextBacktick === -1) {
            break;
        }

        const containing = findRangeContainingIndex(nextBacktick, mergedExcluded);
        if (containing) {
            searchIndex = containing.end;
            continue;
        }

        let tickCount = 1;
        while (nextBacktick + tickCount < content.length && content[nextBacktick + tickCount] === '`') {
            tickCount += 1;
        }

        const closingIndex = findClosingBacktick(content, nextBacktick + tickCount, tickCount, mergedExcluded);
        if (closingIndex === -1) {
            searchIndex = nextBacktick + tickCount;
            continue;
        }

        const rangeEnd = closingIndex + tickCount;
        ranges.push({
            start: nextBacktick,
            end: rangeEnd
        });
        searchIndex = rangeEnd;
    }

    return mergeRanges(ranges);
}

/** Returns true if the index falls within any of the provided ranges */
export function isIndexInRanges(index: number, ranges: readonly NumericRange[]): boolean {
    return findRangeContainingIndex(index, ranges) !== null;
}
