import { IconProvider, IconDefinition } from '../types';
import { IconAssetRecord } from '../external/IconAssetDatabase';

interface FontAwesomeMetadataItem {
    unicode: string;
    label?: string;
    styles?: string[];
    search?: {
        terms?: string[];
    };
    aliases?: {
        names?: string[];
    };
}

interface FontAwesomeProviderOptions {
    record: IconAssetRecord;
    fontFamily: string;
}

interface IconLookupEntry {
    unicode: string;
    keywords: string[];
}

/**
 * Icon provider for Font Awesome Regular icons loaded from external assets.
 */
export class FontAwesomeIconProvider implements IconProvider {
    readonly id = 'fontawesome-regular';
    readonly name = 'Font Awesome Regular';

    private readonly fontFamily: string;
    private iconDefinitions: IconDefinition[] = [];
    private iconLookup = new Map<string, IconLookupEntry>();
    private fontFace: FontFace | null = null;
    private fontLoadPromise: Promise<FontFace> | null = null;

    constructor(options: FontAwesomeProviderOptions) {
        this.fontFamily = options.fontFamily;
        this.parseMetadata(options.record.metadata);
        this.ensureFontLoaded(options.record.data);
    }

    dispose(): void {
        if (this.fontFace) {
            try {
                this.removeFontFromDocument(this.fontFace);
            } catch (error) {
                console.error('[FontAwesomeIconProvider] Failed to delete font face', error);
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
        container.removeClass('nn-iconfont-fa-regular');
        container.removeClass('nn-iconfont-rpg-awesome');
        if (!icon) {
            return;
        }

        const glyph = this.unicodeToGlyph(icon.unicode);
        container.setText(glyph);
        container.addClass('nn-iconfont');
        container.addClass('nn-iconfont-fa-regular');

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

        // Ensure the font is loaded; ignore errors because we fallback to glyph anyway
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
            const parsed = JSON.parse(raw) as Record<string, FontAwesomeMetadataItem>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, IconLookupEntry>();

            for (const [iconId, data] of Object.entries(parsed)) {
                if (!data || !data.unicode) {
                    continue;
                }
                if (Array.isArray(data.styles) && !data.styles.includes('regular')) {
                    continue;
                }

                const keywords = new Set<string>();
                keywords.add(iconId);
                data.search?.terms?.forEach(term => keywords.add(term.toLowerCase()));
                data.aliases?.names?.forEach(alias => keywords.add(alias.toLowerCase()));

                const displayName = data.label || this.formatDisplayName(iconId);
                const unicode = data.unicode;

                definitions.push({
                    id: iconId,
                    displayName,
                    keywords: Array.from(keywords)
                });
                lookup.set(iconId, {
                    unicode,
                    keywords: Array.from(keywords)
                });
            }

            this.iconDefinitions = definitions;
            this.iconLookup = lookup;
        } catch (error) {
            console.error('[FontAwesomeIconProvider] Failed to parse metadata', error);
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
                console.error('[FontAwesomeIconProvider] Failed to load font', error);
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
