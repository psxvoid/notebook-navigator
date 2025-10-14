import { describe, expect, it } from 'vitest';
import { extractMetadataFromCache } from '../../src/utils/metadataExtractor';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorSettings } from '../../src/settings/types';

type CachedMetadata = {
    frontmatter?: Record<string, unknown>;
};

/**
 * Creates test settings with frontmatter metadata enabled
 * @param overrides - Optional settings to override defaults
 * @returns NotebookNavigatorSettings configured for testing
 */
function createSettings(overrides: Partial<NotebookNavigatorSettings> = {}): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        useFrontmatterMetadata: true,
        frontmatterIconField: 'icon',
        ...overrides
    };
}

describe('extractMetadataFromCache - icon extraction', () => {
    it('normalizes plain emoji values to emoji provider format', () => {
        const settings = createSettings();
        const metadata = {
            frontmatter: {
                icon: '🔭'
            }
        } as CachedMetadata;

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.icon).toBe('emoji:🔭');
    });

    it('retains emoji provider values without modification', () => {
        const settings = createSettings();
        const metadata = {
            frontmatter: {
                icon: 'emoji:🔭'
            }
        } as CachedMetadata;

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.icon).toBe('emoji:🔭');
    });

    it('retains non-emoji icon values', () => {
        const settings = createSettings();
        const metadata = {
            frontmatter: {
                icon: 'SiGithub'
            }
        } as CachedMetadata;

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.icon).toBe('simple-icons:github');
    });
});
