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

export class PreviewTextUtils {
    /**
     * Strips markdown syntax from text to create clean preview text
     * @param text The text to strip markdown from
     * @returns The text with markdown syntax removed
     */
    static stripMarkdownSyntax(text: string): string {
        // Order matters - process from inside out
        return text
            // Heading markers at start of line
            .replace(/^#+\s+/gm, '')
            // Inline code (must be before bold/italic to avoid conflicts)
            .replace(/`([^`]+)`/g, '$1')
            // Bold italic combined
            .replace(/\*\*\*([^\*]+)\*\*\*/g, '$1')
            .replace(/___([^_]+)___/g, '$1')
            // Bold
            .replace(/\*\*([^\*]+)\*\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            // Italic (be careful not to match multiplication)
            .replace(/(?<!\d)\*([^\*\n]+)\*(?!\d)/g, '$1')
            .replace(/(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g, '$1')
            // Strikethrough
            .replace(/~~([^~]+)~~/g, '$1')
            // Highlight
            .replace(/==([^=]+)==/g, '$1')
            // Links
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
            // Wiki links with display text
            .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
            // Wiki links without display text
            .replace(/\[\[([^\]]+)\]\]/g, '$1')
            // List markers at start of line
            .replace(/^[-*+]\s+/gm, '')
            .replace(/^\d+\.\s+/gm, '')
            // Blockquotes
            .replace(/^>\s+/gm, '')
            // Escape characters
            .replace(/\\([*_~`])/g, '$1');
    }

    /**
     * Extracts preview text from markdown content
     * @param content The full markdown content
     * @param settings The plugin settings to determine skip behavior
     * @returns The preview text (max 100 chars) or a descriptive message
     */
    static extractPreviewText(content: string, settings: NotebookNavigatorSettings): string {
        let lines = content.split('\n');
        let startIndex = 0;
        
        // Skip frontmatter
        if (lines[0] === '---') {
            let endIndex = lines.findIndex((line, idx) => idx > 0 && line === '---');
            if (endIndex > 0) {
                startIndex = endIndex + 1;
            }
        }
        
        // Count attachments and web links in the entire document first
        let attachmentCount = 0;
        let webLinkCount = 0;
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for markdown images with URLs (these are web links, not attachments)
            const markdownImages = line.match(/!\[.*?\]\((.*?)\)/g);
            if (markdownImages) {
                markdownImages.forEach(match => {
                    const urlMatch = match.match(/!\[.*?\]\((.*?)\)/);
                    if (urlMatch && urlMatch[1]) {
                        const url = urlMatch[1];
                        // If it's a web URL, count as web link
                        if (url.match(/^https?:\/\/|^www\./)) {
                            webLinkCount++;
                        } else {
                            // Local image, count as attachment
                            attachmentCount++;
                        }
                    }
                });
            }
            
            // Count Obsidian wiki-style embeds: ![[...]] (always attachments)
            const wikiEmbeds = line.match(/!\[\[.*?\]\]/g);
            if (wikiEmbeds) {
                attachmentCount += wikiEmbeds.length;
            }
            
            // Count web links but exclude those that are part of markdown images
            // First remove markdown images and embeds from the line
            const cleanLine = line
                .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
                .replace(/!\[\[.*?\]\]/g, ''); // Remove wiki embeds
            
            // Now count web links in the cleaned line
            const webLinks = cleanLine.match(/(?:https?:\/\/|www\.)[^\s\)]+/g);
            if (webLinks) {
                webLinkCount += webLinks.length;
            }
        }
        
        // Find content lines based on settings
        let previewLines = [];
        let charCount = 0;
        const maxChars = 300; // Increased to accommodate up to 5 lines
        
        for (let i = startIndex; i < lines.length && charCount < maxChars; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) continue;
            
            // Skip headings if enabled
            if (settings.skipHeadingsInPreview && line.match(/^#+\s/)) continue;
            
            // Skip non-text content if enabled
            if (settings.skipNonTextInPreview) {
                // Skip markdown images and embeds
                if (line.match(/^!\[.*?\]\(.*?\)/)) continue;
                
                // Skip Obsidian wiki-style embeds (images, files, etc)
                if (line.match(/^!\[\[.*?\]\]/)) continue;
                
                // Skip standalone links that look like embeds
                if (line.match(/^\[.*\]\(.*\)$/)) continue;
                
                // Skip code blocks
                if (line.startsWith('```')) continue;
                
                // Skip horizontal rules
                if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) continue;
                
                // Skip callout blocks (e.g., > [!info], > [!note], > [!warning])
                if (line.match(/^>\s*\[![\w-]+\]/)) continue;
                
                // Skip block quotes that might contain non-text
                if (line.startsWith('>') && line.match(/!\[.*\]\(.*\)/)) continue;
            }
            
            previewLines.push(lines[i]);
            charCount += lines[i].length;
        }
        
        // If no content found, return Notes style message
        if (previewLines.length === 0) {
            if (attachmentCount > 0) {
                // If there are attachments, count both attachments and web links together
                const totalCount = attachmentCount + webLinkCount;
                return totalCount === 1 ? '1 attachment' : `${totalCount} attachments`;
            } else if (webLinkCount > 0) {
                return webLinkCount === 1 ? '1 web link' : `${webLinkCount} web links`;
            }
            return 'No additional text';
        }
        
        // Strip markdown syntax from each line before joining
        let preview = previewLines
            .map(line => this.stripMarkdownSyntax(line))
            .join(' ');
        
        // Now trim to maxChars after stripping
        preview = preview.substring(0, maxChars);
        
        return preview + (preview.length >= maxChars ? '...' : '');
    }
}