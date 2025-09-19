import { IconProvider, IconDefinition } from '../types';
import { IconAssetRecord } from '../external/IconAssetDatabase';
import { resetIconContainer } from './providerUtils';

interface MaterialIconMetadataItem {
    unicode: string;
    label?: string;
    search?: string[];
}

interface MaterialProviderOptions {
    record: IconAssetRecord;
    fontFamily: string;
}

interface IconLookupEntry {
    unicode: string;
    keywords: string[];
}

export class MaterialIconProvider implements IconProvider {
    readonly id = 'material-icons';
    readonly name = 'Material Icons';

    private readonly fontFamily: string;
    private iconDefinitions: IconDefinition[] = [];
    private iconLookup = new Map<string, IconLookupEntry>();
    private fontFace: FontFace | null = null;
    private fontLoadPromise: Promise<FontFace> | null = null;

    constructor(options: MaterialProviderOptions) {
        this.fontFamily = options.fontFamily;
        this.parseMetadata(options.record.metadata);
        this.ensureFontLoaded(options.record.data);
    }

    dispose(): void {
        if (this.fontFace) {
            try {
                this.removeFontFromDocument(this.fontFace);
            } catch (error) {
                console.error('[MaterialIconProvider] Failed to delete font face', error);
            }
            this.fontFace = null;
        }
    }

    isAvailable(): boolean {
        return this.iconDefinitions.length > 0;
    }

    render(container: HTMLElement, iconId: string, size?: number): void {
        const icon = this.iconLookup.get(iconId);
        resetIconContainer(container);
        if (!icon) {
            return;
        }

        container.addClass('nn-iconfont');
        container.addClass('nn-iconfont-material-icons');
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
            const parsed = JSON.parse(raw) as Record<string, MaterialIconMetadataItem>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, IconLookupEntry>();

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

            this.iconDefinitions = definitions;
            this.iconLookup = lookup;
        } catch (error) {
            console.error('[MaterialIconProvider] Failed to parse metadata', error);
            this.iconDefinitions = [];
            this.iconLookup.clear();
        }
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
                console.error('[MaterialIconProvider] Failed to load font', error);
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

    private formatDisplayName(iconId: string): string {
        return iconId
            .split(/[-_]/g)
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
