import { IconDefinition } from '../types';
import { BaseFontIconProvider, BaseFontIconProviderOptions } from './BaseFontIconProvider';

interface MaterialIconMetadataItem {
    unicode: string;
    label?: string;
    search?: string[];
}

/**
 * Icon provider for Google Material Icons web font.
 */
export class MaterialIconProvider extends BaseFontIconProvider {
    readonly id = 'material-icons';
    readonly name = 'Material Icons';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-material-icons';
    }

    /**
     * Parses Material Icons JSON metadata into icon definitions.
     */
    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as Record<string, MaterialIconMetadataItem>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            Object.entries(parsed).forEach(([iconId, data]) => {
                if (!data || !data.unicode) {
                    return;
                }

                const keywords = new Set<string>();
                keywords.add(iconId);
                data.search?.forEach(term => keywords.add(term.toLowerCase()));
                iconId.split(/[-_]/g).forEach(part => {
                    if (part) {
                        keywords.add(part.toLowerCase());
                    }
                });
                if (data.label) {
                    keywords.add(data.label.toLowerCase());
                }

                const displayName = data.label || this.formatDisplayName(iconId);

                definitions.push({
                    id: iconId,
                    displayName,
                    keywords: Array.from(keywords)
                });

                lookup.set(iconId, {
                    unicode: data.unicode,
                    keywords: Array.from(keywords)
                });
            });

            this.setIconData(definitions, lookup);
        } catch (error) {
            this.logParseError('Failed to parse metadata', error);
            this.clearIconData();
        }
    }

    /**
     * Converts snake_case or kebab-case icon ID to title case.
     */
    private formatDisplayName(iconId: string): string {
        return iconId
            .split(/[-_]/g)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
