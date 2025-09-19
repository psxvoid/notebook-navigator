import { IconProvider, IconDefinition } from '../types';
import { IconAssetRecord } from '../external/IconAssetDatabase';

interface RpgAwesomeMetadataEntry {
    id: string;
    name?: string;
    unicode: string;
    keywords?: string[];
    categories?: string[];
}

interface RpgAwesomeProviderOptions {
    record: IconAssetRecord;
    fontFamily: string;
}

interface IconLookupEntry {
    unicode: string;
    keywords: string[];
}

/**
 * Icon provider for RPG Awesome icons loaded from external assets.
 */
export class RpgAwesomeIconProvider implements IconProvider {
    readonly id = 'rpg-awesome';
    readonly name = 'RPG Awesome';

    private readonly fontFamily: string;
    private iconDefinitions: IconDefinition[] = [];
    private iconLookup = new Map<string, IconLookupEntry>();
    private fontFace: FontFace | null = null;
    private fontLoadPromise: Promise<FontFace> | null = null;

    constructor(options: RpgAwesomeProviderOptions) {
        this.fontFamily = options.fontFamily;
        this.parseMetadata(options.record.metadata);
        this.ensureFontLoaded(options.record.data);
    }

    dispose(): void {
        if (this.fontFace) {
            try {
                this.removeFontFromDocument(this.fontFace);
            } catch (error) {
                console.error('[RpgAwesomeIconProvider] Failed to delete font face', error);
            }
            this.fontFace = null;
        }
    }

    isAvailable(): boolean {
        return this.iconDefinitions.length > 0;
    }

    render(container: HTMLElement, iconId: string, size?: number): void {
        const icon = this.iconLookup.get(iconId);
        container.empty();
        container.removeClass('nn-emoji-icon');
        container.removeClass('nn-iconfont');
        container.removeClass('nn-iconfont-rpg-awesome');
        container.removeClass('nn-iconfont-fa-regular');
        if (!icon) {
            return;
        }

        container.addClass('nn-iconfont');
        container.addClass('nn-iconfont-rpg-awesome');
        container.setText(this.unicodeToGlyph(icon.unicode));

        if (size) {
            container.style.fontSize = `${size}px`;
            container.style.width = `${size}px`;
            container.style.height = `${size}px`;
            container.style.lineHeight = `${size}px`;
        } else {
            container.style.removeProperty('font-size');
            container.style.removeProperty('width');
            container.style.removeProperty('height');
            container.style.removeProperty('line-height');
        }

        this.fontLoadPromise?.catch(() => undefined);
    }

    search(query: string): IconDefinition[] {
        const normalized = query.trim().toLowerCase();
        if (!normalized) {
            return [];
        }

        return this.iconDefinitions.filter(icon => {
            const keywords = this.iconLookup.get(icon.id)?.keywords || [];
            if (icon.displayName.toLowerCase().includes(normalized)) {
                return true;
            }
            return keywords.some(keyword => keyword.includes(normalized));
        });
    }

    getAll(): IconDefinition[] {
        return this.iconDefinitions;
    }

    private parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as RpgAwesomeMetadataEntry[] | Record<string, RpgAwesomeMetadataEntry | string>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, IconLookupEntry>();

            if (Array.isArray(parsed)) {
                parsed.forEach(item => this.addEntry(item, definitions, lookup));
            } else {
                Object.entries(parsed).forEach(([key, value]) => {
                    if (typeof value === 'string') {
                        this.addEntry({ id: key, unicode: value }, definitions, lookup);
                        return;
                    }

                    const entryValue = value as Partial<RpgAwesomeMetadataEntry>;
                    this.addEntry(
                        {
                            id: entryValue.id ?? key,
                            name: entryValue.name,
                            unicode: entryValue.unicode || '',
                            keywords: entryValue.keywords,
                            categories: entryValue.categories
                        },
                        definitions,
                        lookup
                    );
                });
            }

            this.iconDefinitions = definitions;
            this.iconLookup = lookup;
        } catch (error) {
            console.error('[RpgAwesomeIconProvider] Failed to parse metadata', error);
            this.iconDefinitions = [];
            this.iconLookup.clear();
        }
    }

    private addEntry(entry: RpgAwesomeMetadataEntry, definitions: IconDefinition[], lookup: Map<string, IconLookupEntry>): void {
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
    }

    private ensureFontLoaded(data: ArrayBuffer): void {
        if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
            return;
        }

        const fontFace = new FontFace(this.fontFamily, data);
        this.fontLoadPromise = fontFace
            .load()
            .then(loaded => {
                this.addFontToDocument(loaded);
                this.fontFace = loaded;
                return loaded;
            })
            .catch(error => {
                console.error('[RpgAwesomeIconProvider] Failed to load font', error);
                throw error;
            });
    }

    private unicodeToGlyph(unicode: string): string {
        try {
            return String.fromCodePoint(parseInt(unicode, 16));
        } catch {
            return '';
        }
    }

    private formatDisplayName(id: string): string {
        return id
            .replace(/^ra-/, '')
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    private addFontToDocument(fontFace: FontFace): void {
        if (typeof document === 'undefined') {
            return;
        }
        const fontSet = document.fonts as unknown as { add?: (font: FontFace) => void };
        fontSet.add?.(fontFace);
    }

    private removeFontFromDocument(fontFace: FontFace): void {
        if (typeof document === 'undefined') {
            return;
        }
        const fontSet = document.fonts as unknown as { delete?: (font: FontFace) => void };
        fontSet.delete?.(fontFace);
    }
}
