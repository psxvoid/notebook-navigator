import { IconDefinition } from '../types';
import { BaseFontIconProvider, BaseFontIconProviderOptions } from './BaseFontIconProvider';

interface PhosphorMetadataEntry {
    id: string;
    name?: string;
    unicode: string;
    keywords?: string[];
    categories?: string[];
}

export class PhosphorIconProvider extends BaseFontIconProvider {
    readonly id = 'phosphor';
    readonly name = 'Phosphor Icons';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-phosphor';
    }

    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as PhosphorMetadataEntry[];
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            parsed.forEach(entry => {
                if (!entry || !entry.id || !entry.unicode) {
                    return;
                }

                const keywords = new Set<string>();
                keywords.add(entry.id);
                entry.keywords?.forEach(keyword => keywords.add(keyword.toLowerCase()));
                entry.categories?.forEach(category => keywords.add(category.toLowerCase()));

                const displayName = entry.name || this.formatDisplayName(entry.id);

                definitions.push({
                    id: entry.id,
                    displayName,
                    keywords: Array.from(keywords)
                });

                lookup.set(entry.id, {
                    unicode: entry.unicode,
                    keywords: Array.from(keywords)
                });
            });

            this.setIconData(definitions, lookup);
        } catch (error) {
            this.logParseError('Failed to parse metadata', error);
            this.clearIconData();
        }
    }

    private formatDisplayName(id: string): string {
        return id
            .replace(/^ph-/, '')
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
