import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
    IconPackConfig,
    ProcessContext,
    compareVersions,
    downloadText,
    downloadBinary
} from './shared';

// Import all icon pack configs
import { bootstrapIcons } from './config/bootstrap-icons';
import { fontAwesome } from './config/fontawesome';
import { materialIcons } from './config/material-icons';
import { phosphor } from './config/phosphor';
import { rpgAwesome } from './config/rpg-awesome';
import { simpleIcons } from './config/simple-icons';

const ICON_PACKS = [
    bootstrapIcons,
    fontAwesome,
    materialIcons,
    phosphor,
    rpgAwesome,
    simpleIcons
];

const ICON_ASSETS_ROOT = path.resolve(__dirname, '..');
const PUBLIC_BASE_URL = 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets';

// Parse command line arguments
const args = process.argv.slice(2);
const checkOnly = args.includes('--check-only');
const forceUpdate = args.includes('--force');
const requestedIds = new Set(args.filter(arg => !arg.startsWith('--')));

async function updateConfigVersion(configPath: string, newVersion: string): Promise<void> {
    const content = await fs.readFile(configPath, 'utf8');
    const updated = content.replace(
        /version:\s*['"][\d.]+['"]/,
        `version: '${newVersion}'`
    );
    await fs.writeFile(configPath, updated);
}

async function processIconPack(pack: IconPackConfig): Promise<void> {
    const configPath = path.join(__dirname, 'config', `${pack.id.replace(/-/g, '')}.ts`);

    // Check for updates
    const latestVersion = pack.checkVersion ? await pack.checkVersion() : pack.version;
    const needsUpdate = compareVersions(pack.version, latestVersion);

    if (checkOnly) {
        if (needsUpdate) {
            console.log(`[${pack.id}] Update available: ${pack.version} → ${latestVersion}`);
        } else {
            console.log(`[${pack.id}] Up to date: ${pack.version}`);
        }
        return;
    }

    if (!needsUpdate && !forceUpdate) {
        console.log(`[${pack.id}] Already up to date: ${pack.version}`);
        return;
    }

    const targetVersion = needsUpdate ? latestVersion : pack.version;
    console.log(`[${pack.id}] ${needsUpdate ? 'Updating' : 'Processing'} version ${targetVersion}`);

    // Update config file if needed
    if (needsUpdate) {
        await updateConfigVersion(configPath, targetVersion);
        pack.version = targetVersion;
    }

    // Get URLs for the target version
    const urls = pack.urls(targetVersion);

    // Download font file
    const packDir = path.join(ICON_ASSETS_ROOT, pack.id);
    await fs.mkdir(packDir, { recursive: true });

    console.log(`[${pack.id}] Downloading font from ${urls.font}`);
    const fontContents = await downloadBinary(urls.font);
    await fs.writeFile(path.join(packDir, pack.files.font), fontContents);

    // Process metadata
    let metadata: string;
    if (pack.processMetadata) {
        const context: ProcessContext = {
            version: targetVersion,
            urls,
            downloadText,
            downloadBinary
        };
        metadata = await pack.processMetadata(context);
    } else {
        // Simple download for packs without custom processing
        if (!urls.metadata) {
            throw new Error(`[${pack.id}] No metadata URL or processor defined`);
        }
        console.log(`[${pack.id}] Downloading metadata from ${urls.metadata}`);
        metadata = await downloadText(urls.metadata);
    }

    // Ensure metadata ends with newline
    const metadataWithNewline = metadata.endsWith('\n') ? metadata : metadata + '\n';
    await fs.writeFile(path.join(packDir, pack.files.metadata), metadataWithNewline);

    // Generate latest.json
    const latestManifest = {
        version: targetVersion,
        font: `${PUBLIC_BASE_URL}/${pack.id}/${pack.files.font}`,
        metadata: `${PUBLIC_BASE_URL}/${pack.id}/${pack.files.metadata}`,
        fontMimeType: pack.files.mimeType,
        metadataFormat: 'json'
    };

    await fs.writeFile(
        path.join(packDir, 'latest.json'),
        `${JSON.stringify(latestManifest, null, 2)}\n`
    );

    if (needsUpdate) {
        console.log(`[${pack.id}] Successfully updated from ${pack.version} to ${latestVersion}`);
    } else {
        console.log(`[${pack.id}] Successfully processed version ${targetVersion}`);
    }
}

async function main(): Promise<void> {
    const packs = ICON_PACKS.filter(pack =>
        requestedIds.size === 0 || requestedIds.has(pack.id)
    );

    if (packs.length === 0) {
        const available = ICON_PACKS.map(pack => pack.id).join(', ');
        throw new Error(`No matching icon packs. Available packs: ${available}`);
    }

    for (const pack of packs) {
        try {
            await processIconPack(pack);
        } catch (error) {
            console.error(`[${pack.id}] Error:`, error);
            if (!forceUpdate) {
                throw error;
            }
        }
    }

    if (checkOnly) {
        console.log('\n💡 Run without --check-only to apply updates');
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});