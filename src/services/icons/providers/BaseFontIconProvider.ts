import { IconProvider, IconDefinition } from '../types';
import { IconAssetRecord } from '../external/IconAssetDatabase';
import { resetIconContainer } from './providerUtils';

export interface BaseFontIconProviderOptions {
    record: IconAssetRecord;
    fontFamily: string;
}

interface IconLookupEntry {
    unicode: string;
    keywords: string[];
}

export abstract class BaseFontIconProvider implements IconProvider {
    abstract readonly id: string;
    abstract readonly name: string;

    private readonly fontFamily: string;
    private fontFace: FontFace | null = null;
    private fontLoadPromise: Promise<FontFace> | null = null;

    protected iconDefinitions: IconDefinition[] = [];
    protected iconLookup: Map<string, IconLookupEntry> = new Map();

    constructor(options: BaseFontIconProviderOptions) {
        this.fontFamily = options.fontFamily;
        this.parseMetadata(options.record.metadata);
        this.ensureFontLoaded(options.record.data);
    }

    dispose(): void {
        if (this.fontFace) {
            try {
                this.removeFontFromDocument(this.fontFace);
            } catch (error) {
                console.error(`${this.getLogPrefix()} Failed to delete font face`, error);
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
        container.addClass(this.getCssClass());
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

    protected abstract parseMetadata(raw: string): void;

    protected abstract getCssClass(): string;

    protected setIconData(definitions: IconDefinition[], lookup: Map<string, IconLookupEntry>): void {
        this.iconDefinitions = definitions;
        this.iconLookup = lookup;
    }

    protected clearIconData(): void {
        this.iconDefinitions = [];
        this.iconLookup.clear();
    }

    protected logParseError(message: string, error: unknown): void {
        console.error(`${this.getLogPrefix()} ${message}`, error);
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
                console.error(`${this.getLogPrefix()} Failed to load font`, error);
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

    private getLogPrefix(): string {
        return `[${this.name}]`;
    }
}
