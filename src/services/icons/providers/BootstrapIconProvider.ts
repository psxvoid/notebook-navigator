import { IconDefinition } from '../types';
import { BaseFontIconProvider, BaseFontIconProviderOptions } from './BaseFontIconProvider';

export class BootstrapIconProvider extends BaseFontIconProvider {
    readonly id = 'bootstrap-icons';
    readonly name = 'Bootstrap Icons';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-bootstrap-icons';
    }

    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as Record<string, string>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            Object.entries(parsed).forEach(([iconId, unicode]) => {
                if (!unicode) {
                    return;
                }

                const keywords = new Set<string>();
                keywords.add(iconId);
                iconId.split('-').forEach(part => {
                    if (part) {
                        keywords.add(part.toLowerCase());
                    }
                });

                const displayName = this.formatDisplayName(iconId);

                definitions.push({
                    id: iconId,
                    displayName,
                    keywords: Array.from(keywords)
                });

                lookup.set(iconId, {
                    unicode,
                    keywords: Array.from(keywords)
                });
            });

            this.setIconData(definitions, lookup);
        } catch (error) {
            this.logParseError('Failed to parse metadata', error);
            this.clearIconData();
        }
    }

    private formatDisplayName(iconId: string): string {
        return iconId
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
