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

import { NotebookNavigatorSettings } from '../settings';

// Base patterns used in both regex versions
const BASE_PATTERNS = [
    // Group 0: Code blocks - remove entirely
    // Example: ```javascript\nconst x = 1;\n``` → (removed)
    /```[\s\S]*?```/.source,
    // Group 1: Inline code - remove entirely
    // Example: `console.log()` → (removed)
    /`[^`]+`/.source,
    // Group 2: Images and embeds - remove entirely
    // Example: ![alt](image.png) → (removed)
    /!\[.*?\]\([^\)]+\)/.source,
    // Group 3: Wiki embeds - remove entirely
    // Example: ![[image.png]] or ![[_resources/Pasted image.png]] → (removed)
    /!\[\[.*?\]\]/.source,
    // Group 4: Escape characters
    // Example: \* → *
    /\\([*_~`])/.source,
    // Group 5: Bold italic stars (must come before bold/italic)
    // Example: ***important*** → important
    /\*\*\*((?:(?!\*\*\*).)+)\*\*\*/.source,
    // Group 6: Bold italic underscores (must come before bold/italic)
    // Example: ___important___ → important
    /___((?:(?!___).)+)___/.source,
    // Group 7: Bold stars
    // Example: **bold** → bold
    /\*\*((?:(?!\*\*).)+)\*\*/.source,
    // Group 8: Bold underscores
    // Example: __bold__ → bold
    /__((?:(?!__).)+)__/.source,
    // Group 9: Italic stars (iOS compatible - no lookbehind)
    // Example: *italic* → italic (but not 5*6*7)
    // Captures: [9] = prefix, [10] = content
    /(^|[^*\d])\*([^*\n]+)\*(?![*\d])/.source,
    // Group 10: Italic underscores (iOS compatible - no lookbehind)
    // Example: _italic_ → italic (but not variable_name_here)
    // Captures: [10] = prefix, [11] = content
    /(^|[^_a-zA-Z0-9])_([^_\n]+)_(?![_a-zA-Z0-9])/.source,
    // Group 11: Strikethrough
    // Example: ~~deleted~~ → deleted
    /~~((?:(?!~~).)+)~~/.source,
    // Group 12: Highlight
    // Example: ==highlighted== → highlighted
    /==((?:(?!==).)+)==/.source,
    // Group 13: Links
    // Example: [Google](https://google.com) → Google
    /\[([^\]]+)\]\([^\)]+\)/.source,
    // Group 14: Wiki links with display
    // Example: [[Some Page|Display Text]] → Display Text
    /\[\[[^\]|]+\|([^\]]+)\]\]/.source,
    // Group 15: Wiki links
    // Example: [[Some Page]] → Some Page
    /\[\[([^\]]+)\]\]/.source,
    // Group 16: Lists and blockquotes - non-capturing group
    // Example: - List item → (removed), * List → (removed), > Quote → (removed)
    /^(?:[-*+]\s+|\d+\.\s+|>\s+)/.source,
    // Group 17: Heading markers (always strip the # symbols, keep the text)
    // Example: # Title → Title, ## Section → Section
    /^(#+)\s+(.*)$/m.source
];

// Regex without heading removal
const REGEX_STRIP_MARKDOWN = new RegExp(BASE_PATTERNS.join('|'), 'gm');

// Both regexes are now the same since heading handling is in the replacement logic
const REGEX_STRIP_MARKDOWN_WITH_HEADINGS = REGEX_STRIP_MARKDOWN;

export class PreviewTextUtils {
    /**
     * Strips markdown syntax from text to create clean preview text
     * @param text The text to strip markdown from
     * @param skipHeadings Whether to also remove headings
     * @returns The text with markdown syntax removed
     */
    static stripMarkdownSyntax(text: string, skipHeadings: boolean = false): string {
        const regex = skipHeadings ? REGEX_STRIP_MARKDOWN_WITH_HEADINGS : REGEX_STRIP_MARKDOWN;

        return text.replace(regex, (match, ...groups) => {
            // Check for specific patterns to remove entirely
            // Code blocks
            if (match.startsWith('```')) {
                return '';
            }

            // Inline code
            if (match.startsWith('`') && match.endsWith('`')) {
                return '';
            }

            // Images and embeds
            if (match.startsWith('!')) {
                return '';
            }

            // Headings - always strip # symbols
            if (match.match(/^#+\s+/)) {
                // If skipHeadings is true, remove entire heading
                if (skipHeadings) {
                    return '';
                }
                // Otherwise, return just the heading text without # symbols
                // The heading text is in the last captured group before offset/string
                const headingTextIndex = groups.length - 3; // -2 for offset/string, -1 for heading text position
                return groups[headingTextIndex] || '';
            }

            // Lists and blockquotes
            if (match.match(/^[-+>\d]/) || match.match(/^\*\s+/)) {
                return '';
            }

            // Find first defined capture group - that's our content to keep
            for (let i = 0; i < groups.length - 2; i++) {
                // -2 for offset and string
                if (groups[i] !== undefined) {
                    // Special handling for italic patterns with prefixes
                    // - Italic stars: prefix at index 5, content at index 6
                    // - Italic underscores: prefix at index 7, content at index 8
                    if (i === 5 && groups[6] !== undefined) {
                        // Italic stars
                        return groups[5] + groups[6];
                    }
                    if (i === 7 && groups[8] !== undefined) {
                        // Italic underscores
                        return groups[7] + groups[8];
                    }
                    return groups[i];
                }
            }

            return match;
        });
    }

    /**
     * Extracts preview text from markdown content
     * Simple one-pass implementation with fixed 250 char limit
     * @param content The full markdown content
     * @param settings The plugin settings
     * @param frontmatter Optional frontmatter object to check for preview properties
     * @returns The preview text (max 250 chars) or empty string
     */
    static extractPreviewText(content: string, settings: NotebookNavigatorSettings, frontmatter?: any): string {
        // Check preview properties first if frontmatter is provided
        if (frontmatter && settings.previewProperties && settings.previewProperties.length > 0) {
            for (const property of settings.previewProperties) {
                if (frontmatter[property]) {
                    const propertyValue = String(frontmatter[property]).trim();
                    if (propertyValue) {
                        // Apply same character limit to property values
                        const maxChars = 250;
                        if (propertyValue.length > maxChars) {
                            return propertyValue.substring(0, maxChars - 1) + '…';
                        }
                        return propertyValue;
                    }
                }
            }
        }

        // Fallback to extracting from content
        if (!content) return '';

        // Remove frontmatter in one shot
        const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
        if (!contentWithoutFrontmatter.trim()) return '';

        // Strip all markdown at once with appropriate regex
        const stripped = this.stripMarkdownSyntax(contentWithoutFrontmatter, settings.skipHeadingsInPreview);

        // Clean up extra whitespace and truncate
        const preview = stripped
            .split(/\s+/) // Split on any whitespace
            .filter(word => word) // Remove empty strings
            .join(' ') // Join with single spaces
            .trim();

        if (!preview) return '';

        // Fixed 250 character limit with ellipsis
        const maxChars = 250;
        if (preview.length > maxChars) {
            return preview.substring(0, maxChars - 1) + '…';
        }

        return preview;
    }
}
