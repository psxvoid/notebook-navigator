import { promises as fs } from 'node:fs';
import path from 'node:path';

interface ReadmeSection {
    readonly version: string;
    readonly content: string;
}

interface FetchContext {
    readonly config: IconPackConfig;
    readonly section: ReadmeSection;
    readonly iconAssetsDir: string;
    getUrl(label: string): string;
    downloadText(url: string): Promise<string>;
    downloadBinary(url: string): Promise<Buffer>;
}

interface IconPackConfig {
    readonly id: string;
    readonly name: string;
    readonly headingLabel: string;
    readonly fontFileName: string;
    readonly metadataFileName: string;
    readonly fontMimeType: string;
    readonly metadataFormat: 'json';
    readonly fontLabel: string;
    readonly metadataLabel?: string;
    readonly metadataFetcher?: (context: FetchContext) => Promise<string>;
    readonly metadataFormatter?: (raw: string, context: FetchContext) => Promise<string>;
    readonly fontUrlOverride?: (context: FetchContext) => Promise<string>;
}

const ICON_ASSETS_ROOT = path.resolve(__dirname, '..');
const README_PATH = path.join(ICON_ASSETS_ROOT, 'README.md');
const PUBLIC_BASE_URL = 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets';

async function main(): Promise<void> {
    const readme = await fs.readFile(README_PATH, 'utf8');
    const requestedIds = new Set(process.argv.slice(2));
    const packs = ICON_PACKS.filter(pack => requestedIds.size === 0 || requestedIds.has(pack.id));

    if (packs.length === 0) {
        const available = ICON_PACKS.map(pack => pack.id).join(', ');
        throw new Error(`No matching icon packs. Available packs: ${available}`);
    }

    for (const pack of packs) {
        const section = extractSection(readme, pack.headingLabel);
        const context: FetchContext = {
            config: pack,
            section,
            iconAssetsDir: ICON_ASSETS_ROOT,
            getUrl: label => getUrlFromSection(section.content, label),
            downloadText,
            downloadBinary
        };

        console.log(`[${pack.id}] Updating to version ${section.version}`);

        const packDir = path.join(ICON_ASSETS_ROOT, pack.id);
        await fs.mkdir(packDir, { recursive: true });

        const fontUrl = pack.fontUrlOverride ? await pack.fontUrlOverride(context) : context.getUrl(pack.fontLabel);
        console.log(`[${pack.id}] Downloading font from ${fontUrl}`);
        const fontContents = await context.downloadBinary(fontUrl);
        await fs.writeFile(path.join(packDir, pack.fontFileName), fontContents);

        const metadata = await fetchMetadata(context);
        await fs.writeFile(path.join(packDir, pack.metadataFileName), metadata);

        const latestManifest = {
            version: section.version,
            font: `${PUBLIC_BASE_URL}/${pack.id}/${pack.fontFileName}`,
            metadata: `${PUBLIC_BASE_URL}/${pack.id}/${pack.metadataFileName}`,
            fontMimeType: pack.fontMimeType,
            metadataFormat: pack.metadataFormat
        };

        await fs.writeFile(path.join(packDir, 'latest.json'), `${JSON.stringify(latestManifest, null, 2)}\n`);
    }
}

async function fetchMetadata(context: FetchContext): Promise<string> {
    const { config } = context;

    if (config.metadataFetcher) {
        const raw = await config.metadataFetcher(context);
        return ensureTrailingNewline(raw);
    }

    if (!config.metadataLabel) {
        throw new Error(`Metadata label missing for pack ${config.id}`);
    }

    const url = context.getUrl(config.metadataLabel);
    console.log(`[${config.id}] Downloading metadata from ${url}`);
    const raw = await context.downloadText(url);

    if (config.metadataFormatter) {
        return ensureTrailingNewline(await config.metadataFormatter(raw, context));
    }

    return ensureTrailingNewline(raw);
}

function ensureTrailingNewline(value: string): string {
    return value.endsWith('\n') ? value : `${value}\n`;
}

function extractSection(readme: string, headingLabel: string): ReadmeSection {
    const headingRegex = new RegExp(`^##\\s+${escapeRegExp(headingLabel)}\\s+([^\\n]+)$`, 'm');
    const match = headingRegex.exec(readme);

    if (!match) {
        throw new Error(`Unable to find heading for "${headingLabel}" in README.md`);
    }

    const version = match[1].trim();
    const startIndex = match.index;
    const rest = readme.slice(startIndex + match[0].length);
    const nextHeadingIndex = rest.search(/^##\s+/m);
    const endIndex = nextHeadingIndex === -1 ? readme.length : startIndex + match[0].length + nextHeadingIndex;
    const content = readme.slice(startIndex, endIndex);

    return { version, content };
}

function getUrlFromSection(section: string, label: string): string {
    const patterns = [
        new RegExp(`\\*\\*${escapeRegExp(label)}:\\*\\*\\s*(\\S+)`),
        new RegExp(`\\*\\*${escapeRegExp(label)}\\*\\*:\\s*(\\S+)`)
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(section);
        if (match) {
            return match[1].trim();
        }
    }

    throw new Error(`Unable to find URL for label "${label}"`);
}

async function downloadBinary(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function downloadText(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    return await response.text();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sortObject<T>(input: Record<string, T>): Record<string, T> {
    const sorted: Record<string, T> = {};
    Object.keys(input)
        .sort((a, b) => a.localeCompare(b))
        .forEach(key => {
            sorted[key] = input[key];
        });
    return sorted;
}

function titleCaseFromSlug(slug: string): string {
    return slug
        .split(/[-_]/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

const ICON_PACKS: IconPackConfig[] = [
    {
        id: 'bootstrap-icons',
        name: 'Bootstrap Icons',
        headingLabel: 'Bootstrap Icons',
        fontFileName: 'bootstrap-icons.woff2',
        metadataFileName: 'bootstrap-icons.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json',
        fontLabel: 'Font File (WOFF2)',
        metadataLabel: 'Metadata (JSON)'
    },
    {
        id: 'fontawesome',
        name: 'FontAwesome',
        headingLabel: 'FontAwesome',
        fontFileName: 'fa-solid-900.woff2',
        metadataFileName: 'icons-solid.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json',
        fontLabel: 'Font File (Solid)',
        metadataLabel: 'Metadata (All Icons)',
        metadataFormatter: async raw => {
            const parsed = JSON.parse(raw) as Record<
                string,
                {
                    unicode?: string;
                    label?: string;
                    styles?: string[];
                    search?: { terms?: string[] };
                    aliases?: {
                        names?: string[];
                        unicodes?: { secondary?: string[] };
                    };
                }
            >;
            const filtered: Record<string, { unicode: string; label: string; search: string[] }> = {};

            Object.entries(parsed).forEach(([key, value]) => {
                if (!value || !value.unicode) {
                    return;
                }

                if (!value.styles || !value.styles.includes('solid')) {
                    return;
                }

                const terms = new Set<string>();
                terms.add(key);

                if (value.label) {
                    terms.add(value.label);
                }

                value.search?.terms?.forEach(term => terms.add(term));
                value.aliases?.names?.forEach(alias => terms.add(alias));
                value.aliases?.unicodes?.secondary?.forEach(aliasUnicode => terms.add(aliasUnicode));

                filtered[key] = {
                    unicode: value.unicode,
                    label: value.label ?? titleCaseFromSlug(key),
                    search: Array.from(terms)
                };
            });

            return JSON.stringify(sortObject(filtered), null, 2);
        }
    },
    {
        id: 'material-icons',
        name: 'Google Material Icons',
        headingLabel: 'Google Material Icons',
        fontFileName: 'MaterialIcons-Regular.woff2',
        metadataFileName: 'icons.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json',
        fontLabel: 'Font File (WOFF2)',
        metadataLabel: 'Codepoints',
        metadataFormatter: async raw => {
            const entries = raw
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean);

            const result: Record<string, { unicode: string; label: string; search: string[] }> = {};

            entries.forEach(line => {
                const [name, unicode] = line.split(/\s+/);

                if (!name || !unicode) {
                    return;
                }

                result[name] = {
                    unicode: unicode.toLowerCase(),
                    label: name,
                    search: [name]
                };
            });

            return JSON.stringify(sortObject(result), null, 2);
        }
    },
    {
        id: 'phosphor',
        name: 'Phosphor Icons',
        headingLabel: 'Phosphor Icons',
        fontFileName: 'phosphor-regular.woff2',
        metadataFileName: 'icons.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json',
        fontLabel: 'Font File (Regular)',
        metadataLabel: 'CSS Stylesheet',
        metadataFetcher: async context => {
            const cssUrl = context.getUrl('CSS Stylesheet');
            console.log(`[${context.config.id}] Downloading CSS metadata from ${cssUrl}`);
            const css = await context.downloadText(cssUrl);
            const entries: Array<{
                id: string;
                name: string;
                unicode: string;
                keywords: string[];
                categories: string[];
            }> = [];
            const idPattern = /\.ph-([a-z0-9-]+)::?before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)";?\s*}/g;
            const seen = new Set<string>();

            let match: RegExpExecArray | null;
            while ((match = idPattern.exec(css)) !== null) {
                const slug = match[1];
                const unicode = match[2].toLowerCase();
                const id = `ph-${slug}`;

                if (seen.has(id)) {
                    continue;
                }

                seen.add(id);

                const tokens = slug.split('-').filter(Boolean);
                const displayName = tokens.map(token => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');
                const keywords = new Set<string>();
                keywords.add(id);
                tokens.forEach(token => keywords.add(token));
                keywords.add(displayName.toLowerCase());

                entries.push({
                    id,
                    name: displayName,
                    unicode,
                    keywords: Array.from(keywords),
                    categories: []
                });
            }

            entries.sort((a, b) => a.id.localeCompare(b.id));

            if (entries.length === 0) {
                throw new Error(`[${context.config.id}] No icons parsed from CSS stylesheet ${cssUrl}`);
            }

            return `${JSON.stringify(entries, null, 2)}\n`;
        }
    },
    {
        id: 'rpg-awesome',
        name: 'RPG Awesome',
        headingLabel: 'RPG-Awesome',
        fontFileName: 'rpgawesome-webfont.woff',
        metadataFileName: 'icons.json',
        fontMimeType: 'font/woff',
        metadataFormat: 'json',
        fontLabel: 'Font File (WOFF)',
        metadataLabel: 'CSS Stylesheet',
        metadataFetcher: async context => {
            const cssUrl = context.getUrl('CSS Stylesheet');
            console.log(`[${context.config.id}] Downloading CSS metadata from ${cssUrl}`);
            const css = await context.downloadText(cssUrl);
            const entries: Array<{
                id: string;
                name: string;
                unicode: string;
                keywords: string[];
                categories: string[];
            }> = [];

            // Pattern to match both escaped sequences and direct Unicode characters
            const idPattern = /\.ra-([a-z0-9-]+)::?before\s*\{\s*content:\s*["'](.+?)["'];?\s*}/g;
            const seen = new Set<string>();

            let match: RegExpExecArray | null;
            while ((match = idPattern.exec(css)) !== null) {
                const slug = match[1];
                const contentValue = match[2];
                const id = `ra-${slug}`;

                if (seen.has(id)) {
                    continue;
                }

                seen.add(id);

                // Handle both escaped sequences and direct Unicode characters
                let unicode: string;
                if (contentValue.startsWith('\\')) {
                    // Handle escape sequences like \e900
                    const hexMatch = contentValue.match(/\\([0-9a-fA-F]+)/);
                    if (hexMatch) {
                        unicode = hexMatch[1].toLowerCase();
                    } else {
                        continue;
                    }
                } else if (contentValue.length === 1) {
                    // Direct Unicode character - convert to hex
                    unicode = contentValue.charCodeAt(0).toString(16).toLowerCase();
                } else {
                    continue;
                }

                const tokens = slug.split('-').filter(Boolean);
                const displayName = tokens.map(token => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');
                const keywords = new Set<string>();
                keywords.add(id);
                tokens.forEach(token => keywords.add(token));
                keywords.add(displayName.toLowerCase());

                entries.push({
                    id,
                    name: displayName,
                    unicode,
                    keywords: Array.from(keywords),
                    categories: []
                });
            }

            entries.sort((a, b) => a.id.localeCompare(b.id));

            if (entries.length === 0) {
                throw new Error(`[${context.config.id}] No icons parsed from CSS stylesheet ${cssUrl}`);
            }

            return `${JSON.stringify(entries, null, 2)}\n`;
        }
    },
    {
        id: 'simple-icons',
        name: 'Simple Icons',
        headingLabel: 'Simple Icons',
        fontFileName: 'SimpleIcons.woff2',
        metadataFileName: 'simple-icons.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json',
        fontLabel: 'Font File (WOFF2)',
        metadataLabel: 'Metadata (JSON)',
        metadataFetcher: async context => {
            const cssUrl = context.getUrl('CSS Stylesheet');
            const metadataUrl = context.getUrl('Metadata (JSON)');

            console.log(`[${context.config.id}] Downloading CSS mapping from ${cssUrl}`);
            const css = await context.downloadText(cssUrl);
            console.log(`[${context.config.id}] Downloading metadata from ${metadataUrl}`);
            const metadataRaw = await context.downloadText(metadataUrl);

            const glyphMap = new Map<string, string>();
            const cssPattern = /\.si-([a-z0-9-]+)::?before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)";?\s*}/g;
            let cssMatch: RegExpExecArray | null;

            while ((cssMatch = cssPattern.exec(css)) !== null) {
                const slug = cssMatch[1];
                const unicode = cssMatch[2].toLowerCase();
                glyphMap.set(slug, unicode);
            }

            const parsed = JSON.parse(metadataRaw) as Array<{
                title: string;
                slug: string;
                aliases?: { aka?: string[]; dup?: string[] };
            }>;

            const result: Record<string, { unicode: string; label: string; search: string[] }> = {};

            parsed.forEach(entry => {
                if (!entry || !entry.slug) {
                    return;
                }

                const unicode = glyphMap.get(entry.slug);

                if (!unicode) {
                    return;
                }

                const searchTerms = new Set<string>();
                searchTerms.add(entry.slug);
                searchTerms.add(entry.title);
                entry.aliases?.aka?.forEach(alias => searchTerms.add(alias));
                entry.aliases?.dup?.forEach(alias => searchTerms.add(alias));

                result[entry.slug] = {
                    unicode,
                    label: entry.title,
                    search: Array.from(searchTerms)
                };
            });

            if (Object.keys(result).length === 0) {
                throw new Error(`[${context.config.id}] No icons matched between CSS and metadata sources`);
            }

            return `${JSON.stringify(sortObject(result), null, 2)}\n`;
        }
    }
];

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
