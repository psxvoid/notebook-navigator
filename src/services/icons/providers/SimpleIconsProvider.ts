import { IconDefinition } from '../types';
import { BaseFontIconProvider, BaseFontIconProviderOptions } from './BaseFontIconProvider';

/**
 * Structure of each icon entry in the Simple Icons metadata JSON
 */
interface SimpleIconsMetadataItem {
    unicode: string;     // Unicode character code for the icon
    label?: string;      // Display label for the icon
    search?: string[];   // Additional search terms
}

/**
 * Icon provider for Simple Icons web font.
 */
export class SimpleIconsProvider extends BaseFontIconProvider {
    readonly id = 'simple-icons';
    readonly name = 'Simple Icons';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-simple-icons';
    }

    /**
     * Parses Simple Icons metadata file.
     */
    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as Record<string, SimpleIconsMetadataItem>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            Object.entries(parsed).forEach(([iconId, data]) => {
                if (!data || !data.unicode) {
                    return;
                }

                const keywords = new Set<string>();
                keywords.add(iconId);

                const label = data.label?.trim();
                if (label) {
                    keywords.add(label.toLowerCase());
                }

                data.search?.forEach(term => {
                    const normalized = term?.trim().toLowerCase();
                    if (normalized) {
                        keywords.add(normalized);
                    }
                });

                iconId.split('-').forEach(part => {
                    const normalized = part.trim().toLowerCase();
                    if (normalized) {
                        keywords.add(normalized);
                    }
                });

                const displayName = label || this.formatDisplayName(iconId);
                const keywordList = Array.from(keywords);

                definitions.push({
                    id: iconId,
                    displayName,
                    keywords: keywordList
                });

                lookup.set(iconId, {
                    unicode: data.unicode,
                    keywords: keywordList
                });
            });

            this.setIconData(definitions, lookup);
        } catch (error) {
            this.logParseError('Failed to parse metadata', error);
            this.clearIconData();
        }
    }

    /**
     * Formats an icon ID into a human-readable display name.
     * Converts kebab-case to Title Case.
     */
    private formatDisplayName(iconId: string): string {
        return iconId
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
