import { TFile } from 'obsidian';

/**
 * Parses the excluded files setting into an array of property names
 */
export function parseExcludedProperties(excludedFiles: string): string[] {
    return excludedFiles
        .split(',')
        .map(p => p.trim())
        .filter(p => p);
}

/**
 * Checks if a file should be excluded based on its frontmatter properties
 */
export function shouldExcludeFile(file: TFile, excludedProperties: string[], app: any): boolean {
    if (excludedProperties.length === 0) return false;
    
    const metadata = app.metadataCache.getFileCache(file);
    if (!metadata?.frontmatter) return false;
    
    return excludedProperties.some(prop => prop in metadata.frontmatter!);
}