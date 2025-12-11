/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import { FrontMatterCache } from 'obsidian';
import { isExcalidrawFileName } from './fileNameUtils';
import { NotebookNavigatorSettings } from '../settings';
import { getRecordValue } from './typeGuards';
import { findFencedCodeBlockRanges, findInlineCodeRanges, findRangeContainingIndex } from './codeRangeUtils';
import { NumericRange } from './arrayUtils';

// Maximum number of characters for preview text
const MAX_PREVIEW_TEXT_LENGTH = 500;
// Extra buffer when clipping source content to allow room for code block extraction
const PREVIEW_SOURCE_SLACK = 400;
// Allow limited overrun when extending clips to finish code spans
const PREVIEW_EXTENSION_LIMIT = MAX_PREVIEW_TEXT_LENGTH + PREVIEW_SOURCE_SLACK * 2;

// Incremented each call to ensure placeholder strings are globally unique
let placeholderSeed = 0;

/** Generates a unique placeholder prefix using label, timestamp, and counter */
function createPlaceholderBase(label: string): string {
    placeholderSeed += 1;
    return `@@NN_${label}_${Date.now().toString(36)}_${placeholderSeed}@@`;
}

/** Builds a placeholder string by appending the segment index to the base */
function buildPlaceholder(base: string, index: number): string {
    return `${base}_${index}@@`;
}

/** Escapes special regex characters so the string can be used as a literal pattern */
function escapeRegExpLiteral(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface HtmlStripOptions {
    preserveInlineCode?: boolean;
    preserveFencedCode?: boolean;
}

interface CodeRangeContext {
    inlineCodeRanges: NumericRange[];
    fencedCodeRanges: NumericRange[];
}

// Base patterns used in both regex versions
const BASE_PATTERNS = [
    // Group 0: Code blocks - remove entirely
    // Examples: ```javascript\nconst x = 1;\n``` and ~~~\nconst x = 1;\n~~~ → (removed)
    // Known limitation: closing fence must use the same character count as the opening fence.
    // Obsidian's renderer shares this limitation, and lines like "~~~ note" are not parsed as fenced blocks.
    /([`~]{3,})[\s\S]*?\1/.source,
    // Group 1: Obsidian comments - remove entirely (both inline and block)
    // Example: %%comment%% → (removed), %%\nmultiline\n%% → (removed)
    /%%[\s\S]*?%%/.source,
    // Group 2: Inline code - remove backticks but keep text
    // Example: `console.log()` → console.log()
    /`[^`]+`/.source,
    // Group 3: Images and embeds - remove entirely
    // Example: ![alt](image.png) → (removed)
    /!\[.*?\]\([^)]+\)/.source,
    // Group 4: Wiki embeds - remove entirely
    // Example: ![[image.png]] or ![[_resources/Pasted image.png]] → (removed)
    /!\[\[.*?\]\]/.source,
    // Group 5: Tags - remove entirely
    // Example: #tag, #parent/child → (removed)
    // Must be followed by whitespace or end of line to avoid matching things like #1 in issue numbers
    /#[\w\-/]+(?=\s|$)/.source,
    // Group 6: Escape characters
    // Example: \* → *
    /\\([*_~`])/.source,
    // Group 7: Bold italic stars (must come before bold/italic)
    // Example: ***important*** → important
    /\*\*\*((?:(?!\*\*\*).)+)\*\*\*/.source,
    // Group 8: Bold italic underscores (must come before bold/italic)
    // Example: ___important___ → important
    /___((?:(?!___).)+)___/.source,
    // Group 9: Bold italic nested - bold stars with italic underscores
    // Example: **_important_** → important
    /\*\*_((?:(?!_\*\*).)+)_\*\*/.source,
    // Group 10: Bold italic nested - bold underscores with italic stars
    // Example: __*important*__ → important
    /__\*((?:(?!\*__).)+)\*__/.source,
    // Group 11: Bold stars with highlight
    // Example: **==important==** → important
    /\*\*==((?:(?!==\*\*).)+)==\*\*/.source,
    // Group 12: Highlight with bold stars
    // Example: ==**important**== → important
    /==\*\*((?:(?!\*\*==).)+)\*\*==/.source,
    // Group 13: Bold underscores with highlight
    // Example: __==important==__ → important
    /__==((?:(?!==__).)+)==__/.source,
    // Group 14: Highlight with bold underscores
    // Example: ==__important__== → important
    /==__((?:(?!__==).)+)__==/.source,
    // Group 15: Bold stars
    // Example: **bold** → bold
    /\*\*((?:(?!\*\*).)+)\*\*/.source,
    // Group 16: Bold underscores
    // Example: __bold__ → bold
    /__((?:(?!__).)+)__/.source,
    // Group 17: Italic stars (iOS compatible - no lookbehind)
    // Example: *italic* → italic (but not 5*6*7)
    // Captures: [17] = prefix, [18] = content
    /(^|[^*\d])\*([^*\n]+)\*(?![*\d])/.source,
    // Group 18: Italic underscores (iOS compatible - no lookbehind)
    // Example: _italic_ → italic (but not variable_name_here)
    // Captures: [18] = prefix, [19] = content
    /(^|[^_a-zA-Z0-9])_([^_\n]+)_(?![_a-zA-Z0-9])/.source,
    // Group 19: Strikethrough
    // Example: ~~deleted~~ → deleted
    /~~((?:(?!~~).)+)~~/.source,
    // Group 20: Highlight
    // Example: ==highlighted== → highlighted
    /==((?:(?!==).)+)==/.source,
    // Group 21: Links
    // Example: [Google](https://google.com) → Google
    /\[([^\]]+)\]\([^)]+\)/.source,
    // Group 22: Wiki links with display
    // Example: [[Some Page|Display Text]] → Display Text
    /\[\[[^\]|]+\|([^\]]+)\]\]/.source,
    // Group 23: Wiki links
    // Example: [[Some Page]] → Some Page
    /\[\[([^\]]+)\]\]/.source,
    // Group 24: Callout titles (supports [!...] and [!...]+/-)
    // Examples:
    // [!info] Optional title → (removed)
    // [!info]+ Optional title → (removed)
    // [!info]- Optional title → (removed)
    /\[![\w-]+\][+-]?(?:\s+[^\n]*)?/.source,
    // Group 25: List markers - remove marker prefix while keeping text
    // Example: - List item → List item, 1. Item → Item
    /^(?:[-*+]\s+|\d+\.\s+)/.source,
    // Group 26: Blockquotes - remove entire line
    // Example: > Quote → (removed), >Quote → (removed)
    /^>\s?.*$/m.source,
    // Group 27: Heading markers (always strip the # symbols, keep the text)
    // Example: # Title → Title, ## Section → Section
    /^(#+)\s+(.*)$/m.source,
    // Group 28: Markdown tables - matches table rows (lines with pipes)
    // Example: | Header | Another | → (removed)
    // This captures lines that start with optional whitespace, then |, and contain at least one more |
    /^\s*\|.*\|.*$/m.source,
    // Group 29: Inline footnotes
    // Example: text ^[detail] → text
    /\^\[[^\]]*?]/.source,
    // Group 30: Footnote references
    // Example: reference[^1] → reference
    /\[\^[^\]]+]/.source,
    // Group 31: Footnote definitions
    // Example: [^1]: Footnote text → (removed)
    /^\s*\[\^[^\]]+]:.*$/m.source
];

// Regex without heading removal
const REGEX_STRIP_MARKDOWN = new RegExp(BASE_PATTERNS.join('|'), 'gm');

// Both regexes are now the same since heading handling is in the replacement logic
const REGEX_STRIP_MARKDOWN_WITH_HEADINGS = REGEX_STRIP_MARKDOWN;

/** Removes HTML tags from a chunk of text, preserving inner text content */
function stripHtmlFromChunk(chunk: string): string {
    if (!chunk.includes('<')) {
        return chunk;
    }

    let cleaned = chunk;

    // Remove script/style blocks entirely
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, ' ');

    // Replace known separators with spaces to avoid word collisions
    cleaned = cleaned.replace(/<br\s*\/?>/gi, ' ');
    cleaned = cleaned.replace(/<hr\s*\/?>/gi, ' ');
    cleaned = cleaned.replace(/<\/(p|div|section|article|header|footer|main|aside|nav|li|ul|ol|blockquote|h[1-6]|tr|td|th|table)>/gi, ' ');

    // Strip remaining tags while keeping text content
    cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');

    return cleaned;
}

/** Normalizes whitespace by splitting on runs and joining with single spaces */
function collapseWhitespace(text: string): string {
    return text.split(/\s+/).filter(Boolean).join(' ').trim();
}

/** Strips leading and trailing backticks from an inline code span */
function stripInlineCodeFence(span: string): string {
    let contentStart = 0;
    while (contentStart < span.length && span[contentStart] === '`') {
        contentStart += 1;
    }

    let contentEnd = span.length;
    while (contentEnd > contentStart && span[contentEnd - 1] === '`') {
        contentEnd -= 1;
    }

    return span.slice(contentStart, contentEnd);
}

/** Removes YAML frontmatter block from the start of content */
function removeFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n/, '');
}

/** Replaces inline code spans with their unwrapped content (backticks removed) */
function unwrapInlineCodeSegments(text: string, inlineRanges: readonly NumericRange[]): string {
    if (inlineRanges.length === 0) {
        return text;
    }

    let cursor = 0;
    let result = '';

    inlineRanges.forEach(range => {
        if (range.start > cursor) {
            result += text.slice(cursor, range.start);
        }
        const content = stripInlineCodeFence(text.slice(range.start, range.end));
        result += content;
        cursor = range.end;
    });

    if (cursor < text.length) {
        result += text.slice(cursor);
    }

    return result;
}

/** Merges inline and fenced code ranges into a sorted array with kind annotations */
function combineCodeRanges(context: CodeRangeContext, includeInline: boolean, includeFenced: boolean) {
    const combined: (NumericRange & { kind: 'inline' | 'fenced' })[] = [];
    if (includeInline) {
        combined.push(...context.inlineCodeRanges.map(range => ({ ...range, kind: 'inline' as const })));
    }
    if (includeFenced) {
        combined.push(...context.fencedCodeRanges.map(range => ({ ...range, kind: 'fenced' as const })));
    }
    combined.sort((first, second) => first.start - second.start || first.end - second.end);
    return combined;
}

/** Strips HTML tags from text while preserving code segments and remapping their ranges */
function stripHtmlOutsideCode(
    text: string,
    context: CodeRangeContext,
    options?: HtmlStripOptions & { enabled?: boolean }
): { text: string; context: CodeRangeContext } {
    const enabled = options?.enabled ?? true;
    const preserveInlineCode = options?.preserveInlineCode ?? true;
    const preserveFencedCode = options?.preserveFencedCode ?? true;

    if (!enabled || !text.includes('<')) {
        return { text, context };
    }

    if (!preserveInlineCode && !preserveFencedCode) {
        return { text: stripHtmlFromChunk(text), context: { inlineCodeRanges: [], fencedCodeRanges: [] } };
    }

    const combined = combineCodeRanges(context, preserveInlineCode, preserveFencedCode);
    if (combined.length === 0) {
        return {
            text: stripHtmlFromChunk(text),
            context: { inlineCodeRanges: [], fencedCodeRanges: [] }
        };
    }

    let cursor = 0;
    let result = '';
    const mappedInline: NumericRange[] = [];
    const mappedFenced: NumericRange[] = [];

    for (const range of combined) {
        if (range.start > cursor) {
            result += stripHtmlFromChunk(text.slice(cursor, range.start));
        }

        const segmentStart = result.length;
        const segment = text.slice(range.start, range.end);
        result += segment;
        const segmentEnd = result.length;

        if (range.kind === 'inline') {
            mappedInline.push({ start: segmentStart, end: segmentEnd });
        } else {
            mappedFenced.push({ start: segmentStart, end: segmentEnd });
        }

        cursor = range.end;
    }

    if (cursor < text.length) {
        result += stripHtmlFromChunk(text.slice(cursor));
    }

    return {
        text: result,
        context: {
            inlineCodeRanges: mappedInline,
            fencedCodeRanges: mappedFenced
        }
    };
}

/** Remaps inline code ranges that fall within a segment to their new positions in the output */
function adjustInlineRangesForSegment(
    inlineRanges: readonly NumericRange[],
    segmentStart: number,
    segmentEnd: number,
    outputOffset: number,
    target: NumericRange[],
    inlineIndexRef: { current: number }
): void {
    while (inlineIndexRef.current < inlineRanges.length && inlineRanges[inlineIndexRef.current].end <= segmentStart) {
        inlineIndexRef.current += 1;
    }

    let index = inlineIndexRef.current;
    while (index < inlineRanges.length && inlineRanges[index].start < segmentEnd) {
        const range = inlineRanges[index];
        if (range.end <= segmentEnd) {
            target.push({
                start: outputOffset + (range.start - segmentStart),
                end: outputOffset + (range.end - segmentStart)
            });
        }
        index += 1;
    }

    inlineIndexRef.current = index;
}

/** Clips text to target length while skipping fenced code blocks entirely */
function clipSkippingFencedBlocks(
    text: string,
    context: CodeRangeContext,
    targetLength: number
): { text: string; context: CodeRangeContext } {
    if (context.fencedCodeRanges.length === 0 && text.length <= targetLength) {
        return { text, context: { inlineCodeRanges: [...context.inlineCodeRanges], fencedCodeRanges: [] } };
    }

    const inlineRanges = context.inlineCodeRanges;
    const fencedRanges = context.fencedCodeRanges;
    let output = '';
    const mappedInline: NumericRange[] = [];
    const inlineIndexRef = { current: 0 };
    let cursor = 0;

    const appendSegment = (start: number, end: number) => {
        if (start >= end || output.length >= targetLength) {
            return;
        }
        const offset = output.length;
        output += text.slice(start, end);
        adjustInlineRangesForSegment(inlineRanges, start, end, offset, mappedInline, inlineIndexRef);
    };

    const appendGap = (start: number, end: number) => {
        let position = start;
        while (position < end && output.length < targetLength) {
            const remaining = targetLength - output.length;
            let sliceEnd = Math.min(position + remaining, end);
            const containingInline = findRangeContainingIndex(sliceEnd, inlineRanges);
            if (containingInline && containingInline.end <= end && containingInline.end > sliceEnd) {
                sliceEnd = containingInline.end;
            }
            appendSegment(position, sliceEnd);
            position = sliceEnd;
        }
    };

    for (const fenced of fencedRanges) {
        appendGap(cursor, fenced.start);
        if (output.length >= targetLength) {
            break;
        }
        const nextChar = text[fenced.end] ?? '';
        if (
            output.length < targetLength &&
            output.length > 0 &&
            nextChar &&
            !/\s/.test(nextChar) &&
            !/\s/.test(output[output.length - 1])
        ) {
            output += ' ';
        }
        cursor = fenced.end;
    }

    if (output.length < targetLength && cursor < text.length) {
        appendGap(cursor, text.length);
    }

    return {
        text: output,
        context: {
            inlineCodeRanges: mappedInline,
            fencedCodeRanges: []
        }
    };
}

/** Clips text to target length, extending to include any code block the boundary falls within */
function clipIncludingCode(
    text: string,
    context: CodeRangeContext,
    targetLength: number,
    maxExtension: number
): { text: string; context: CodeRangeContext } {
    const softLimit = Math.min(text.length, targetLength);
    const hardLimit = Math.min(text.length, maxExtension);
    if (text.length <= softLimit) {
        return { text, context };
    }

    let sliceEnd = softLimit;

    const containingInline = findRangeContainingIndex(sliceEnd, context.inlineCodeRanges);
    if (containingInline && containingInline.end > sliceEnd) {
        sliceEnd = Math.min(hardLimit, containingInline.end);
    }

    const containingFenced = findRangeContainingIndex(sliceEnd, context.fencedCodeRanges);
    if (containingFenced && containingFenced.end > sliceEnd) {
        sliceEnd = Math.min(hardLimit, containingFenced.end);
    }

    const clippedText = text.slice(0, sliceEnd);
    const clippedInline = context.inlineCodeRanges.filter(range => range.end <= sliceEnd).map(range => ({ ...range }));
    const clippedFenced = context.fencedCodeRanges.filter(range => range.end <= sliceEnd).map(range => ({ ...range }));

    return {
        text: clippedText,
        context: {
            inlineCodeRanges: clippedInline,
            fencedCodeRanges: clippedFenced
        }
    };
}

/** Clips preview content based on settings, delegating to skip or include code block strategies */
function clipPreviewContent(
    text: string,
    context: CodeRangeContext,
    settings: NotebookNavigatorSettings
): { text: string; context: CodeRangeContext } {
    const targetLength = MAX_PREVIEW_TEXT_LENGTH + PREVIEW_SOURCE_SLACK;
    const maxExtension = PREVIEW_EXTENSION_LIMIT;
    if (text.length <= targetLength) {
        return { text, context };
    }

    const clipped = settings.skipCodeBlocksInPreview
        ? clipSkippingFencedBlocks(text, context, targetLength)
        : clipIncludingCode(text, context, targetLength, maxExtension);

    if (clipped.text.length <= maxExtension) {
        return clipped;
    }

    const clampRanges = (ranges: NumericRange[], limit: number): NumericRange[] => {
        const clamped: NumericRange[] = [];
        for (const range of ranges) {
            if (range.start >= limit) {
                continue;
            }
            clamped.push({
                start: range.start,
                end: Math.min(range.end, limit)
            });
        }
        return clamped;
    };

    return {
        text: clipped.text.slice(0, maxExtension),
        context: {
            inlineCodeRanges: clampRanges(clipped.context.inlineCodeRanges, maxExtension),
            fencedCodeRanges: clampRanges(clipped.context.fencedCodeRanges, maxExtension)
        }
    };
}

/** Replaces code segments with placeholders so markdown stripping does not alter code content */
function buildProtectedText(
    text: string,
    context: CodeRangeContext,
    skipCodeBlocks: boolean
): { protectedText: string; inlineSegments: string[]; fencedSegments: string[]; inlineBase: string; fencedBase: string } {
    const inlineBase = createPlaceholderBase('INLINE');
    const fencedBase = createPlaceholderBase('CODE');
    const inlineSegments: string[] = [];
    const fencedSegments: string[] = [];

    const combined = combineCodeRanges(context, true, true);
    if (combined.length === 0) {
        return { protectedText: text, inlineSegments, fencedSegments, inlineBase, fencedBase };
    }

    let cursor = 0;
    let protectedText = '';

    for (const range of combined) {
        if (range.start > cursor) {
            protectedText += text.slice(cursor, range.start);
        }

        if (range.kind === 'inline') {
            const content = stripInlineCodeFence(text.slice(range.start, range.end));
            const placeholder = buildPlaceholder(inlineBase, inlineSegments.length);
            inlineSegments.push(content);
            protectedText += placeholder;
        } else {
            if (skipCodeBlocks) {
                const hasLeadingSpace = protectedText.length > 0 && !/\s$/.test(protectedText);
                const nextChar = text[range.end] ?? '';
                const needsTrailingSpace = nextChar !== '' && !/\s/.test(nextChar);
                if (hasLeadingSpace && needsTrailingSpace) {
                    protectedText += ' ';
                }
                cursor = range.end;
                continue;
            }
            const codeContent = PreviewTextUtils.extractCodeBlockContent(text.slice(range.start, range.end));
            const placeholder = buildPlaceholder(fencedBase, fencedSegments.length);
            fencedSegments.push(codeContent);
            const needsLeadingSpace = protectedText.length > 0 && !/\s$/.test(protectedText);
            if (needsLeadingSpace) {
                protectedText += ' ';
            }
            protectedText += placeholder;
            const nextChar = text[range.end] ?? '';
            if (nextChar !== '' && !/\s/.test(nextChar)) {
                protectedText += ' ';
            }
        }

        cursor = range.end;
    }

    if (cursor < text.length) {
        protectedText += text.slice(cursor);
    }

    return { protectedText, inlineSegments, fencedSegments, inlineBase, fencedBase };
}

/** Replaces placeholder tokens with the original code segment content */
function restorePlaceholders(
    text: string,
    inlineSegments: readonly string[],
    fencedSegments: readonly string[],
    inlineBase: string,
    fencedBase: string
): string {
    let restored = text;

    if (inlineSegments.length > 0) {
        const inlinePattern = new RegExp(`${escapeRegExpLiteral(inlineBase)}_(\\d+)@@`, 'g');
        restored = restored.replace(inlinePattern, (_match, indexString: string) => {
            const index = Number.parseInt(indexString, 10);
            if (Number.isNaN(index) || index < 0 || index >= inlineSegments.length) {
                return '';
            }
            return inlineSegments[index];
        });
    }

    if (fencedSegments.length > 0) {
        const fencedPattern = new RegExp(`${escapeRegExpLiteral(fencedBase)}_(\\d+)@@`, 'g');
        restored = restored.replace(fencedPattern, (_match, indexString: string) => {
            const index = Number.parseInt(indexString, 10);
            if (Number.isNaN(index) || index < 0 || index >= fencedSegments.length) {
                return '';
            }
            return fencedSegments[index];
        });
    }

    return restored;
}

/**
 * Calculates the number of capture groups from regex replacement arguments
 */
function getCaptureLength(args: unknown[]): number {
    if (args.length === 0) {
        return 0;
    }
    const lastArg = args[args.length - 1];
    const hasNamedGroups = typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg);
    const metadataCount = hasNamedGroups ? 3 : 2;
    return Math.max(args.length - metadataCount, 0);
}

/**
 * Extracts a string value from a frontmatter property that could be a string or array
 */
function resolvePreviewPropertyValue(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    if (Array.isArray(value)) {
        for (const entry of value) {
            if (typeof entry !== 'string') {
                continue;
            }
            const trimmed = entry.trim();
            if (trimmed) {
                return trimmed;
            }
        }
    }

    return null;
}

/**
 * Checks if a frontmatter value indicates the file is an Excalidraw drawing
 */
function isTruthyExcalidrawPluginFlag(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return false;
        }
        const normalized = trimmed.toLowerCase();
        return normalized !== 'false' && normalized !== '0';
    }

    return Boolean(value);
}

export class PreviewTextUtils {
    /**
     * Checks if a file is an Excalidraw drawing
     * @param fileName The name of the file
     * @param frontmatter Optional frontmatter object to check
     * @returns True if the file is an Excalidraw drawing
     */
    static isExcalidrawFile(fileName: string, frontmatter?: FrontMatterCache): boolean {
        // Check filename pattern
        if (isExcalidrawFileName(fileName)) {
            return true;
        }

        // Check frontmatter for excalidraw-plugin property
        const pluginFlag = getRecordValue(frontmatter, 'excalidraw-plugin');
        if (isTruthyExcalidrawPluginFlag(pluginFlag)) {
            return true;
        }

        return false;
    }

    /**
     * Strips markdown syntax from text to create clean preview text
     * @param text The text to strip markdown from
     * @param skipHeadings Whether to remove headings
     * @param skipCodeBlocks Whether to remove fenced code blocks
     * @returns The text with markdown syntax removed
     */
    static stripMarkdownSyntax(
        text: string,
        skipHeadings: boolean = false,
        skipCodeBlocks: boolean = true,
        codeRangeContext?: CodeRangeContext
    ): string {
        const regex = skipHeadings ? REGEX_STRIP_MARKDOWN_WITH_HEADINGS : REGEX_STRIP_MARKDOWN;
        const fencedCodeBlocks =
            codeRangeContext && codeRangeContext.fencedCodeRanges.length > 0
                ? codeRangeContext.fencedCodeRanges
                : findFencedCodeBlockRanges(text);
        const inlineCodeRanges =
            codeRangeContext && codeRangeContext.inlineCodeRanges.length > 0
                ? codeRangeContext.inlineCodeRanges
                : findInlineCodeRanges(text, fencedCodeBlocks);
        const context: CodeRangeContext = {
            inlineCodeRanges,
            fencedCodeRanges: fencedCodeBlocks
        };
        const { protectedText, inlineSegments, fencedSegments, inlineBase, fencedBase } = buildProtectedText(text, context, skipCodeBlocks);

        const stripped = protectedText.replace(regex, (match, ...rawArgs) => {
            const args: unknown[] = rawArgs;
            const captureLength = getCaptureLength(args);
            // Obsidian comments
            if (match.startsWith('%%') && match.endsWith('%%')) {
                return '';
            }

            // Callout titles
            if (match.match(/\[![\w-]+\]/)) {
                return '';
            }

            // Inline code
            if (match.startsWith('`') && match.endsWith('`')) {
                return match.slice(1, -1);
            }

            // Images and embeds
            if (match.startsWith('!')) {
                return '';
            }

            // Tags
            if (match.match(/#[\w\-/]+(?=\s|$)/)) {
                return '';
            }

            // Footnote inline syntax and references
            const trimmedFootnoteMatch = match.trimStart();
            if (trimmedFootnoteMatch.startsWith('^[') || trimmedFootnoteMatch.startsWith('[^')) {
                return '';
            }

            // Blockquotes (entire line already matched)
            if (match.startsWith('>')) {
                return match.replace(/^>(?:\s?>)*\s?/, '').trimStart();
            }

            // Italic with stars - preserve prefix and content
            const italicStarMatch = match.match(/(^|[^*\d])\*([^*\n]+)\*(?![*\d])/);
            if (italicStarMatch) {
                const italicStarContent = italicStarMatch[2];
                if (typeof italicStarContent !== 'string' || !italicStarContent.trim()) {
                    return match;
                }
                const italicStarPrefix = italicStarMatch[1] ?? '';
                return `${italicStarPrefix}${italicStarContent}`;
            }

            // Italic with underscores - preserve prefix and content
            const italicUnderscoreMatch = match.match(/(^|[^_a-zA-Z0-9])_([^_\n]+)_(?![_a-zA-Z0-9])/);
            if (italicUnderscoreMatch) {
                const italicUnderscoreContent = italicUnderscoreMatch[2];
                if (typeof italicUnderscoreContent !== 'string' || !italicUnderscoreContent.trim()) {
                    return match;
                }
                const italicUnderscorePrefix = italicUnderscoreMatch[1] ?? '';
                return `${italicUnderscorePrefix}${italicUnderscoreContent}`;
            }

            // Headings - always strip # symbols
            if (match.match(/^#+\s+/)) {
                // If skipHeadings is true, remove entire heading
                if (skipHeadings) {
                    return '';
                }
                // Otherwise, return just the heading text without # symbols
                const headingText = match.replace(/^#+\s+/, '').trim();
                return headingText;
            }

            // List markers
            if (match.match(/^[-+\d]/) || match.match(/^\*\s+/)) {
                return '';
            }

            // Markdown tables
            if (match.match(/^\s*\|.*\|/)) {
                return '';
            }

            // Find first defined capture group - that's our content to keep
            for (let i = 0; i < captureLength; i++) {
                const capture = args[i];
                if (typeof capture === 'string') {
                    return capture;
                }
            }

            return match;
        });

        return restorePlaceholders(stripped, inlineSegments, fencedSegments, inlineBase, fencedBase);
    }

    /**
     * Removes HTML tags outside code blocks (inline and fenced).
     * Preserves tags that are part of code snippets so code samples remain intact unless preservation is disabled.
     */
    static stripHtmlTagsPreservingCode(text: string, options?: HtmlStripOptions): string {
        if (!text.includes('<')) {
            return text;
        }
        const fenced = findFencedCodeBlockRanges(text);
        const inline = findInlineCodeRanges(text, fenced);
        const context: CodeRangeContext = {
            inlineCodeRanges: inline,
            fencedCodeRanges: fenced
        };
        return stripHtmlOutsideCode(text, context, { ...options, enabled: true }).text;
    }

    /**
     * Normalizes excerpts by stripping HTML and collapsing whitespace.
     * Returns undefined when no usable content remains.
     */
    static normalizeExcerpt(excerpt: string, options?: { stripHtml?: boolean }): string | undefined {
        const shouldStripHtml = options?.stripHtml !== false;
        const containsHtml = shouldStripHtml && excerpt.includes('<');
        if (!containsHtml) {
            const inlineOnlyRanges = findInlineCodeRanges(excerpt);
            const unwrappedInline = unwrapInlineCodeSegments(excerpt, inlineOnlyRanges);
            const normalizedInline = collapseWhitespace(unwrappedInline);
            return normalizedInline.length > 0 ? normalizedInline : undefined;
        }
        const fenced = findFencedCodeBlockRanges(excerpt);
        const baseContext: CodeRangeContext = {
            inlineCodeRanges: findInlineCodeRanges(excerpt, fenced),
            fencedCodeRanges: fenced
        };
        // Excerpts always get inline-code fences removed and whitespace collapsed; HTML tags are kept only when stripping is disabled.
        const sanitizedResult = shouldStripHtml
            ? stripHtmlOutsideCode(excerpt, baseContext, { enabled: true })
            : { text: excerpt, context: baseContext };
        const unwrapped = unwrapInlineCodeSegments(sanitizedResult.text, sanitizedResult.context.inlineCodeRanges);
        const normalized = collapseWhitespace(unwrapped);
        return normalized.length > 0 ? normalized : undefined;
    }

    static extractCodeBlockContent(block: string): string {
        // Match opening fence (``` or ~~~) with optional language identifier
        const openingFenceMatch = block.match(/^\s*([`~]{3,})[^\n\r]*\r?\n?/);
        if (!openingFenceMatch) {
            return block;
        }

        // Extract fence character and length for matching closing fence
        const fenceSequence = openingFenceMatch[1];
        const fenceChar = fenceSequence[0] ?? '`';
        const fenceLength = fenceSequence.length;
        // Remove opening fence from block
        const withoutOpeningFence = block.slice(openingFenceMatch[0].length);
        // Build pattern for closing fence (must match character type and be at least same length)
        const closingFencePattern = new RegExp(`\\r?\\n?\\s*${fenceChar}{${fenceLength},}(?:\\s*)$`);
        const withoutClosingFence = withoutOpeningFence.replace(closingFencePattern, '');
        return withoutClosingFence;
    }

    /**
     * Extracts preview text from markdown content
     * Simple one-pass implementation with fixed character limit
     * @param content The full markdown content
     * @param settings The plugin settings
     * @param frontmatter Optional frontmatter object to check for preview properties
     * @returns The preview text (max characters defined by MAX_PREVIEW_TEXT_LENGTH) or empty string
     */
    static extractPreviewText(content: string, settings: NotebookNavigatorSettings, frontmatter?: FrontMatterCache): string {
        // Check preview properties first if frontmatter is provided
        if (frontmatter && settings.previewProperties && settings.previewProperties.length > 0) {
            for (const property of settings.previewProperties) {
                const value = getRecordValue(frontmatter, property);
                const propertyValue = resolvePreviewPropertyValue(value);
                if (!propertyValue) {
                    continue;
                }

                const sanitized = settings.stripHtmlInPreview
                    ? this.stripHtmlTagsPreservingCode(propertyValue, {
                          preserveFencedCode: true
                      })
                    : propertyValue;
                // Collapse whitespace to keep preview rows compact regardless of source formatting
                const normalized = collapseWhitespace(sanitized);
                if (!normalized) {
                    continue;
                }

                const maxChars = MAX_PREVIEW_TEXT_LENGTH;
                if (normalized.length > maxChars) {
                    return `${normalized.substring(0, maxChars - 1)}…`;
                }
                return normalized;
            }
        }

        // Fallback to extracting from content
        if (!content) return '';

        // Remove frontmatter in one shot
        const contentWithoutFrontmatter = removeFrontmatter(content);
        if (!contentWithoutFrontmatter.trim()) return '';

        const fencedCodeRanges = findFencedCodeBlockRanges(contentWithoutFrontmatter);
        const inlineCodeRanges = findInlineCodeRanges(contentWithoutFrontmatter, fencedCodeRanges);
        const codeContext: CodeRangeContext = {
            inlineCodeRanges,
            fencedCodeRanges
        };

        const clipped = clipPreviewContent(contentWithoutFrontmatter, codeContext, settings);
        if (!clipped.text.trim()) {
            return '';
        }

        const htmlStep = settings.stripHtmlInPreview
            ? stripHtmlOutsideCode(clipped.text, clipped.context, {
                  enabled: true,
                  preserveFencedCode: true
              })
            : { text: clipped.text, context: clipped.context };

        if (!htmlStep.text.trim()) {
            return '';
        }

        const stripped = this.stripMarkdownSyntax(
            htmlStep.text,
            settings.skipHeadingsInPreview,
            settings.skipCodeBlocksInPreview,
            htmlStep.context
        );

        // Remove leading task checkbox markers while keeping task text
        const withoutTaskCheckboxes = stripped.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)?\[(?: |x|X|\/|-)?\]\]?\s*/gm, '');

        // Remove horizontal rule lines including spaced variants
        const withoutHorizontalRules = withoutTaskCheckboxes.replace(/^\s*([*_-])(?:\s*\1){2,}\s*$/gm, '');

        // Clean up extra whitespace and truncate
        const preview = collapseWhitespace(withoutHorizontalRules);

        if (!preview) return '';

        // Fixed character limit with ellipsis
        const maxChars = MAX_PREVIEW_TEXT_LENGTH;
        if (preview.length > maxChars) {
            return `${preview.substring(0, maxChars - 1)}…`;
        }

        return preview;
    }
}
