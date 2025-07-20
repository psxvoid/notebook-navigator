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

// Pre-compiled regex patterns for stripping markdown
// Order matters - these are applied sequentially from inside out

// Individual patterns - kept for reference but now unused due to combined regex
// const REGEX_HEADING = /^#+\s+/gm;
// const REGEX_LIST_MARKERS = /^[-*+]\s+/gm;
// const REGEX_ORDERED_LIST_MARKERS = /^\d+\.\s+/gm;
// const REGEX_BLOCKQUOTE = /^>\s+/gm;
// const REGEX_INLINE_CODE = /`([^`]+)`/g;
// const REGEX_BOLD_ITALIC_STARS = /\*\*\*([^\*]+)\*\*\*/g;
// const REGEX_BOLD_ITALIC_UNDERSCORES = /___([^_]+)___/g;
// const REGEX_BOLD_STARS = /\*\*([^\*]+)\*\*/g;
// const REGEX_BOLD_UNDERSCORES = /__([^_]+)__/g;
// const REGEX_ITALIC_STARS = /(^|[^\d])\*([^\*\n]+)\*(?!\d)/g;
// const REGEX_ITALIC_UNDERSCORES = /(^|[^a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g;
// const REGEX_STRIKETHROUGH = /~~([^~]+)~~/g;
// const REGEX_HIGHLIGHT = /==([^=]+)==/g;
// const REGEX_LINK = /\[([^\]]+)\]\([^\)]+\)/g;
// const REGEX_WIKI_LINK_DISPLAY = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
// const REGEX_WIKI_LINK = /\[\[([^\]]+)\]\]/g;
// const REGEX_ESCAPE_CHARS = /\\([*_~`])/g;
// const REGEX_MARKDOWN_IMAGE = /!\[.*?\]\((.*?)\)/g;
// const REGEX_WIKI_EMBED = /!\[\[.*?\]\]/g;
// const REGEX_WEB_URL = /^(https?:\/\/|www\.)/;
// const REGEX_WEB_LINK = /(?:https?:\/\/|www\.)[^\s\)]+/g;

// Combined regex for single-pass markdown stripping
// IMPORTANT: Order matters! More specific patterns must come before less specific ones
const COMBINED_MARKDOWN_REGEX = new RegExp(
    [
        // Group 1: Escape characters - must be first to prevent interference
        /\\([*_~`])/.source,
        // Group 2: Inline code - process early to avoid conflicts
        /`([^`]+)`/.source,
        // Group 3: Bold italic stars (must come before bold/italic)
        /\*\*\*([^\*]+)\*\*\*/.source,
        // Group 4: Bold italic underscores (must come before bold/italic)
        /___([^_]+)___/.source,
        // Group 5: Bold stars
        /\*\*([^\*]+)\*\*/.source,
        // Group 6: Bold underscores
        /__([^_]+)__/.source,
        // Group 7: Italic stars (iOS compatible - not surrounded by digits)
        /(^|[^\d])\*([^\*\n]+)\*(?!\d)/.source,
        // Group 8: Italic underscores (iOS compatible - not surrounded by alphanumeric)
        /(^|[^a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/.source,
        // Group 9: Strikethrough
        /~~([^~]+)~~/.source,
        // Group 10: Highlight
        /==([^=]+)==/.source,
        // Group 11: Links [text](url)
        /\[([^\]]+)\]\([^\)]+\)/.source,
        // Group 12: Wiki links with display [[path|text]]
        /\[\[[^\]|]+\|([^\]]+)\]\]/.source,
        // Group 13: Wiki links [[path]]
        /\[\[([^\]]+)\]\]/.source,
        // Group 14: Line start patterns (headings, lists, blockquotes) - no capture group
        /^(?:#+\s+|[-*+]\s+|\d+\.\s+|>\s+)/.source,
    ].join('|'),
    'gm'
);

export class PreviewTextUtils {
    /**
     * Strips markdown syntax from text to create clean preview text
     * This version uses a single regex pass for significantly better performance
     * @param text The text to strip markdown from
     * @returns The text with markdown syntax removed
     */
    static stripMarkdownSyntax(text: string): string {
        return text.replace(COMBINED_MARKDOWN_REGEX, (...args) => {
            // Use a single loop to find which group matched
            // Start from 1 to skip args[0] (full match)
            for (let i = 1; i < 16; i++) {
                if (args[i] !== undefined) {
                    switch (i) {
                        case 1:  // Escape characters
                        case 2:  // Inline code
                        case 3:  // Bold italic stars
                        case 4:  // Bold italic underscores
                        case 5:  // Bold stars
                        case 6:  // Bold underscores
                        case 11: // Strikethrough
                        case 12: // Highlight
                        case 13: // Links
                        case 14: // Wiki links with display
                        case 15: // Wiki links
                            return args[i];
                        
                        case 7:  // Italic stars (has prefix)
                            if (args[8] !== undefined) return args[7] + args[8];
                            break;
                        
                        case 9:  // Italic underscores (has prefix)
                            if (args[10] !== undefined) return args[9] + args[10];
                            break;
                    }
                }
            }
            
            // Line start patterns - remove entirely
            if (args[0][0] === '#' || args[0][0] === '-' || args[0][0] === '*' || 
                args[0][0] === '+' || args[0][0] === '>' || /^\d/.test(args[0])) {
                return '';
            }
            
            return args[0];
        });
    }


    /**
     * Extracts preview text from markdown content
     * Optimized implementation with early exit and minimal processing
     * @param content The full markdown content
     * @param settings The plugin settings to determine skip behavior
     * @returns The preview text (max 300 chars) or a descriptive message
     */
    static extractPreviewText(content: string, settings: NotebookNavigatorSettings): string {
        // Early exit for empty content
        if (!content || content.length === 0) {
            return '';
        }
        
        // Calculate max chars: 100 for first line, +50 for each additional line, max 300
        const maxChars = Math.min(100 + (settings.previewRows - 1) * 50, 300);
        let startIndex = 0;
        
        // Skip frontmatter using indexOf (more efficient than split)
        if (content.startsWith('---\n')) {
            const endIndex = content.indexOf('\n---\n', 4);
            if (endIndex > 0) {
                startIndex = endIndex + 5; // Skip past "\n---\n"
            }
        }
        
        // Build preview directly without intermediate arrays
        let preview = '';
        let currentIndex = startIndex;
        let hasContent = false;
        
        // If skipTextBeforeFirstHeading is enabled, find the first heading
        if (settings.skipTextBeforeFirstHeading) {
            let foundFirstHeading = false;
            let scanIndex = startIndex;
            
            while (scanIndex < content.length) {
                let lineEnd = content.indexOf('\n', scanIndex);
                if (lineEnd === -1) lineEnd = content.length;
                
                const line = content.substring(scanIndex, lineEnd);
                const trimmedLine = line.trim();
                
                // Check if this is a valid markdown heading (# followed by space)
                if (trimmedLine && trimmedLine[0] === '#') {
                    let i = 1;
                    while (i < trimmedLine.length && trimmedLine[i] === '#') i++;
                    if (i < trimmedLine.length && trimmedLine[i] === ' ') {
                        currentIndex = scanIndex;
                        foundFirstHeading = true;
                        break;
                    }
                }
                
                scanIndex = lineEnd + 1;
            }
            
            // If no heading found and skipTextBeforeFirstHeading is enabled, return empty
            if (!foundFirstHeading) {
                return '';
            }
        }
        
        while (currentIndex < content.length && preview.length < maxChars) {
            // Find next line
            let lineEnd = content.indexOf('\n', currentIndex);
            if (lineEnd === -1) lineEnd = content.length;
            
            const line = content.substring(currentIndex, lineEnd);
            const trimmedLine = line.trim();
            
            // Process non-empty lines
            if (trimmedLine) {
                let shouldInclude = true;
                
                // Skip headings if enabled
                if (settings.skipHeadingsInPreview && trimmedLine[0] === '#') {
                    // Check if it's a valid heading (# followed by space or more #s)
                    let i = 1;
                    while (i < trimmedLine.length && trimmedLine[i] === '#') i++;
                    if (i < trimmedLine.length && trimmedLine[i] === ' ') {
                        shouldInclude = false;
                    }
                }
                
                // Skip non-text content if enabled
                if (shouldInclude && settings.skipNonTextInPreview) {
                    // Quick checks using charAt/startsWith instead of regex
                    if (
                        (trimmedLine[0] === '!' && (trimmedLine[1] === '[' || trimmedLine.startsWith('![['))) ||
                        trimmedLine.startsWith('```') ||
                        (trimmedLine.length >= 3 && (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___')) ||
                        (trimmedLine[0] === '[' && trimmedLine[trimmedLine.length - 1] === ')') ||
                        (trimmedLine.startsWith('> !['))
                    ) {
                        shouldInclude = false;
                    }
                }
                
                if (shouldInclude) {
                    // Strip markdown and add to preview
                    const stripped = this.stripMarkdownSyntax(line);
                    if (preview.length > 0) preview += ' ';
                    preview += stripped;
                    hasContent = true;
                    
                    // Stop if we've collected enough text
                    if (preview.length >= maxChars) {
                        break;
                    }
                }
            }
            
            currentIndex = lineEnd + 1;
        }
        
        // If no content found, do a minimal scan for attachments
        if (!hasContent) {
            let attachmentCount = 0;
            let webLinkCount = 0;
            let scanIndex = startIndex;
            let linesScanned = 0;
            
            // Scan first 20 lines (reduced from 50)
            while (scanIndex < content.length && linesScanned < 20) {
                let lineEnd = content.indexOf('\n', scanIndex);
                if (lineEnd === -1) lineEnd = content.length;
                
                const line = content.substring(scanIndex, lineEnd);
                
                // Simple counting without creating match arrays
                let pos = 0;
                while ((pos = line.indexOf('![', pos)) !== -1) {
                    if (line.indexOf('](', pos) > pos) {
                        attachmentCount++;
                    }
                    pos += 2;
                }
                
                // Count web links
                if (line.includes('http://') || line.includes('https://')) {
                    webLinkCount++;
                }
                
                scanIndex = lineEnd + 1;
                linesScanned++;
            }
            
            if (attachmentCount > 0) {
                const totalCount = attachmentCount + webLinkCount;
                return totalCount === 1 ? '1 attachment' : `${totalCount} attachments`;
            } else if (webLinkCount > 0) {
                return webLinkCount === 1 ? '1 web link' : `${webLinkCount} web links`;
            }
            return '';
        }
        
        // Truncate with ellipsis if needed
        if (preview.length > maxChars) {
            // Ensure we have room for the ellipsis
            return preview.substring(0, maxChars - 1) + '…';
        }
        return preview;
    }
}
