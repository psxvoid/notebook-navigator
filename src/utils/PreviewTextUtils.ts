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

// Line start patterns
const REGEX_HEADING = /^#+\s+/gm;
const REGEX_LIST_MARKERS = /^[-*+]\s+/gm;
const REGEX_ORDERED_LIST_MARKERS = /^\d+\.\s+/gm;
const REGEX_BLOCKQUOTE = /^>\s+/gm;

// Inline patterns - processed in specific order
const REGEX_INLINE_CODE = /`([^`]+)`/g;
const REGEX_BOLD_ITALIC_STARS = /\*\*\*([^\*]+)\*\*\*/g;
const REGEX_BOLD_ITALIC_UNDERSCORES = /___([^_]+)___/g;
const REGEX_BOLD_STARS = /\*\*([^\*]+)\*\*/g;
const REGEX_BOLD_UNDERSCORES = /__([^_]+)__/g;
const REGEX_ITALIC_STARS = /(?<!\d)\*([^\*\n]+)\*(?!\d)/g;
const REGEX_ITALIC_UNDERSCORES = /(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g;
const REGEX_STRIKETHROUGH = /~~([^~]+)~~/g;
const REGEX_HIGHLIGHT = /==([^=]+)==/g;

// Link patterns
const REGEX_LINK = /\[([^\]]+)\]\([^\)]+\)/g;
const REGEX_WIKI_LINK_DISPLAY = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
const REGEX_WIKI_LINK = /\[\[([^\]]+)\]\]/g;

// Special characters
const REGEX_ESCAPE_CHARS = /\\([*_~`])/g;

// Pre-compiled regex patterns for counting attachments/links
const REGEX_MARKDOWN_IMAGE = /!\[.*?\]\((.*?)\)/g;
const REGEX_WIKI_EMBED = /!\[\[.*?\]\]/g;
const REGEX_WEB_URL = /^(https?:\/\/|www\.)/;
const REGEX_WEB_LINK = /(?:https?:\/\/|www\.)[^\s\)]+/g;

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
        // Group 7: Italic stars (with negative lookbehind/ahead for digits)
        /(?<!\d)\*([^\*\n]+)\*(?!\d)/.source,
        // Group 8: Italic underscores (with negative lookbehind/ahead for alphanumeric)
        /(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/.source,
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
            // args = [fullMatch, g1, g2, g3, ..., g14, offset, originalString]
            // Groups 1-13 contain captured text content we want to keep
            
            // Find the first non-undefined capture group (1-13)
            for (let i = 1; i <= 13; i++) {
                if (args[i] !== undefined) {
                    return args[i];
                }
            }
            
            // Group 14 (line start patterns) has no capture - remove entirely
            if (args[0].match(/^(?:#+\s+|[-*+]\s+|\d+\.\s+|>\s+)/)) {
                return '';
            }
            
            // Fallback - should not happen with our regex
            return args[0];
        });
    }


    /**
     * Extracts preview text from markdown content
     * Optimized single-pass implementation that combines counting and preview extraction
     * @param content The full markdown content
     * @param settings The plugin settings to determine skip behavior
     * @returns The preview text (max 300 chars) or a descriptive message
     */
    static extractPreviewText(content: string, settings: NotebookNavigatorSettings): string {
        const lines = content.split('\n');
        let lineIndex = 0;
        
        // Skip frontmatter
        if (lines[0] === '---') {
            const endIndex = lines.findIndex((line, idx) => idx > 0 && line === '---');
            if (endIndex > 0) {
                lineIndex = endIndex + 1;
            }
        }
        
        // Single pass through the document
        let attachmentCount = 0;
        let webLinkCount = 0;
        let previewLines = [];
        let charCount = 0;
        const maxChars = 300; // Increased to accommodate up to 5 lines
        let hasCollectedPreview = false;
        
        while (lineIndex < lines.length) {
            const line = lines[lineIndex];
            const trimmedLine = line.trim();
            
            // Count attachments and links in every line
            // Check for markdown images - need to use exec() to get capture groups
            let imageMatch;
            const imageRegex = new RegExp(REGEX_MARKDOWN_IMAGE.source, 'g');
            while ((imageMatch = imageRegex.exec(line)) !== null) {
                const url = imageMatch[1];
                if (url) {
                    if (REGEX_WEB_URL.test(url)) {
                        webLinkCount++;
                    } else {
                        attachmentCount++;
                    }
                }
            }
            
            // Count wiki embeds
            const wikiEmbeds = line.match(REGEX_WIKI_EMBED);
            if (wikiEmbeds) {
                attachmentCount += wikiEmbeds.length;
            }
            
            // Count web links (excluding those in images)
            const cleanLine = line
                .replace(REGEX_MARKDOWN_IMAGE, '')
                .replace(REGEX_WIKI_EMBED, '');
            const webLinks = cleanLine.match(REGEX_WEB_LINK);
            if (webLinks) {
                webLinkCount += webLinks.length;
            }
            
            // Collect preview text if we haven't reached the limit
            if (!hasCollectedPreview && charCount < maxChars) {
                // Skip empty lines
                if (trimmedLine) {
                    let shouldInclude = true;
                    
                    // Skip headings if enabled
                    if (settings.skipHeadingsInPreview && trimmedLine.match(/^#+\s/)) {
                        shouldInclude = false;
                    }
                    
                    // Skip non-text content if enabled
                    if (shouldInclude && settings.skipNonTextInPreview) {
                        if (
                            trimmedLine.match(/^!\[.*?\]\(.*?\)/) || // Markdown images
                            trimmedLine.match(/^!\[\[.*?\]\]/) ||     // Wiki embeds
                            trimmedLine.match(/^\[.*\]\(.*\)$/) ||    // Standalone links
                            trimmedLine.startsWith('```') ||          // Code blocks
                            trimmedLine.match(/^(-{3,}|\*{3,}|_{3,})$/) || // Horizontal rules
                            trimmedLine.match(/^>\s*\[![\w-]+\]/) ||  // Callout blocks
                            (trimmedLine.startsWith('>') && trimmedLine.match(/!\[.*\]\(.*\)/)) // Blockquotes with images
                        ) {
                            shouldInclude = false;
                        }
                    }
                    
                    if (shouldInclude) {
                        previewLines.push(line);
                        charCount += line.length;
                    }
                }
                
                // Check if we've collected enough preview text
                if (charCount >= maxChars) {
                    hasCollectedPreview = true;
                }
            }
            
            // Early exit optimization: only break if we have preview text AND counted some media
            if (hasCollectedPreview && previewLines.length > 0 && (attachmentCount > 0 || webLinkCount > 0)) {
                break;
            }
            
            lineIndex++;
        }
        
        // If no content found, return Notes style message
        if (previewLines.length === 0) {
            if (attachmentCount > 0) {
                const totalCount = attachmentCount + webLinkCount;
                return totalCount === 1 ? '1 attachment' : `${totalCount} attachments`;
            } else if (webLinkCount > 0) {
                return webLinkCount === 1 ? '1 web link' : `${webLinkCount} web links`;
            }
            return 'No additional text';
        }
        
        // Strip markdown syntax from preview text
        let preview = previewLines
            .map(line => this.stripMarkdownSyntax(line))
            .join(' ')
            .substring(0, maxChars);
        
        return preview + (preview.length >= maxChars ? '...' : '');
    }
}