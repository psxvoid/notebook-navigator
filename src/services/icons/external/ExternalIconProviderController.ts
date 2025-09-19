import { App, requestUrl } from 'obsidian';
import { IconProvider } from '../types';
import { IconService } from '../IconService';
import { ISettingsProvider } from '../../../interfaces/ISettingsProvider';
import { NotebookNavigatorSettings } from '../../../settings';
import { IconAssetDatabase, IconAssetRecord } from './IconAssetDatabase';
import { EXTERNAL_ICON_PROVIDERS, ExternalIconManifest, ExternalIconProviderConfig, ExternalIconProviderId } from './providerRegistry';
import { FontAwesomeIconProvider } from '../providers/FontAwesomeIconProvider';
import { RpgAwesomeIconProvider } from '../providers/RpgAwesomeIconProvider';

interface InstallOptions {
    persistSetting?: boolean;
}

interface RemoveOptions {
    persistSetting?: boolean;
}

/**
 * Coordinates external icon providers: downloads assets, stores them, and registers providers with IconService.
 */
export class ExternalIconProviderController {
    private readonly database: IconAssetDatabase;
    private readonly iconService: IconService;
    private readonly settingsProvider: ISettingsProvider & { settings: NotebookNavigatorSettings };
    private downloadChain: Promise<void> = Promise.resolve();
    private readonly downloadTasks = new Map<ExternalIconProviderId, Promise<void>>();
    private readonly installedProviders = new Set<ExternalIconProviderId>();
    private readonly providerVersions = new Map<ExternalIconProviderId, string>();
    private readonly activeProviders = new Map<
        ExternalIconProviderId,
        { provider: IconProvider & { dispose?: () => void }; version: string }
    >();
    private isInitialized = false;

    constructor(app: App, iconService: IconService, settingsProvider: ISettingsProvider & { settings: NotebookNavigatorSettings }) {
        this.iconService = iconService;
        this.settingsProvider = settingsProvider;
        this.database = new IconAssetDatabase(app);
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        await this.database.init();
        const records = await this.database.getAll();
        records.forEach(record => {
            const id = record.id as ExternalIconProviderId;
            if (EXTERNAL_ICON_PROVIDERS[id]) {
                this.installedProviders.add(id);
                this.providerVersions.set(id, record.version);
            }
        });

        this.isInitialized = true;
    }

    dispose(): void {
        this.activeProviders.forEach(entry => {
            entry.provider.dispose?.();
        });
        this.activeProviders.clear();
        this.database.close();
        this.isInitialized = false;
    }

    isProviderInstalled(id: ExternalIconProviderId): boolean {
        return this.installedProviders.has(id);
    }

    isProviderDownloading(id: ExternalIconProviderId): boolean {
        return this.downloadTasks.has(id);
    }

    getProviderVersion(id: ExternalIconProviderId): string | null {
        return this.providerVersions.get(id) ?? null;
    }

    async installProvider(id: ExternalIconProviderId, options: InstallOptions = {}): Promise<void> {
        await this.ensureInitialized();

        const existingTask = this.downloadTasks.get(id);
        if (existingTask) {
            return existingTask;
        }

        const task = this.enqueue(async () => {
            const config = this.requireProviderConfig(id);

            const manifest = await this.fetchManifest(config);
            const record = await this.downloadAssets(config, manifest);

            await this.database.put(record);
            this.installedProviders.add(id);
            this.providerVersions.set(id, record.version);

            if (options.persistSetting !== false) {
                this.markProviderSetting(id, true);
            }

            const activated = await this.activateIfEnabled(config, record);

            if (options.persistSetting !== false) {
                await this.settingsProvider.saveSettingsAndUpdate();
            } else if (activated) {
                this.settingsProvider.notifySettingsUpdate();
            }
        });

        this.downloadTasks.set(id, task);
        try {
            await task;
        } finally {
            this.downloadTasks.delete(id);
        }
    }

    async removeProvider(id: ExternalIconProviderId, options: RemoveOptions = {}): Promise<void> {
        await this.ensureInitialized();

        const config = this.requireProviderConfig(id);

        // Wait for any in-flight download before removing
        const existingTask = this.downloadTasks.get(id);
        if (existingTask) {
            try {
                await existingTask;
            } catch {
                // ignore download failure when removing
            }
        }

        await this.enqueue(async () => {
            const wasActive = this.deactivateProvider(config.id);
            await this.database.delete(config.id);
            this.installedProviders.delete(config.id);
            this.providerVersions.delete(config.id);

            if (options.persistSetting !== false) {
                this.markProviderSetting(config.id, false);
                await this.settingsProvider.saveSettingsAndUpdate();
            } else if (wasActive) {
                this.settingsProvider.notifySettingsUpdate();
            }
        });
    }

    async syncWithSettings(): Promise<void> {
        await this.ensureInitialized();
        const settings = this.settingsProvider.settings;

        if (!settings.useExternalIconProviders) {
            // Unregister active providers but leave assets intact for next enable
            let changed = false;
            this.activeProviders.forEach((_, providerId) => {
                if (this.deactivateProvider(providerId)) {
                    changed = true;
                }
            });
            if (changed) {
                this.settingsProvider.notifySettingsUpdate();
            }
            return;
        }

        const map = settings.externalIconProviders || {};
        const tasks: Promise<void>[] = [];
        let shouldNotifyAfterLoop = false;

        (Object.keys(EXTERNAL_ICON_PROVIDERS) as ExternalIconProviderId[]).forEach(id => {
            const shouldEnable = !!map[id];
            if (shouldEnable) {
                const config = this.requireProviderConfig(id);
                tasks.push(
                    this.ensureProviderAvailable(config, { persistSetting: false }).catch(error => {
                        console.error(`[IconProviders] Failed to initialize provider ${id}:`, error);
                    })
                );
            } else {
                if (this.deactivateProvider(id)) {
                    shouldNotifyAfterLoop = true;
                }
            }
        });

        await Promise.all(tasks);

        if (shouldNotifyAfterLoop) {
            this.settingsProvider.notifySettingsUpdate();
        }
    }

    private async ensureProviderAvailable(config: ExternalIconProviderConfig, options: InstallOptions): Promise<void> {
        if (!this.isProviderInstalled(config.id)) {
            await this.installProvider(config.id, options);
            return;
        }

        const record = await this.database.get(config.id);
        if (!record) {
            this.installedProviders.delete(config.id);
            this.providerVersions.delete(config.id);
            await this.installProvider(config.id, options);
            return;
        }

        this.providerVersions.set(config.id, record.version);
        const activated = await this.activateIfEnabled(config, record);
        if (activated && options.persistSetting === false) {
            this.settingsProvider.notifySettingsUpdate();
        }
    }

    private markProviderSetting(id: ExternalIconProviderId, enabled: boolean): void {
        const { settings } = this.settingsProvider;
        if (!settings.externalIconProviders) {
            settings.externalIconProviders = {};
        }
        settings.externalIconProviders[id] = enabled;
    }

    private deactivateProvider(id: ExternalIconProviderId): boolean {
        const entry = this.activeProviders.get(id);
        let changed = false;
        if (entry) {
            entry.provider.dispose?.();
            this.activeProviders.delete(id);
            changed = true;
        }
        this.iconService.unregisterProvider(id);
        return changed;
    }

    private async activateIfEnabled(config: ExternalIconProviderConfig, record: IconAssetRecord): Promise<boolean> {
        const settings = this.settingsProvider.settings;
        if (!settings.useExternalIconProviders) {
            return false;
        }
        if (!settings.externalIconProviders || !settings.externalIconProviders[config.id]) {
            return false;
        }

        const activeEntry = this.activeProviders.get(config.id);
        if (activeEntry && activeEntry.version === record.version) {
            return false;
        }

        if (activeEntry) {
            this.deactivateProvider(config.id);
        }

        const provider = this.createProvider(config, record);
        if (!provider) {
            console.warn(`[IconProviders] Provider ${config.id} could not be created.`);
            return false;
        }

        this.iconService.registerProvider(provider);
        this.activeProviders.set(config.id, { provider, version: record.version });
        return true;
    }

    private createProvider(config: ExternalIconProviderConfig, record: IconAssetRecord): (IconProvider & { dispose?: () => void }) | null {
        switch (config.id) {
            case 'fontawesome-regular':
                return new FontAwesomeIconProvider({
                    record,
                    fontFamily: config.fontFamily
                });
            case 'rpg-awesome':
                return new RpgAwesomeIconProvider({
                    record,
                    fontFamily: config.fontFamily
                });
            default:
                return null;
        }
    }

    private async fetchManifest(config: ExternalIconProviderConfig): Promise<ExternalIconManifest> {
        const response = await requestUrl({
            url: config.manifestUrl,
            method: 'GET',
            headers: {
                'User-Agent': 'NotebookNavigator/1.0 (Obsidian Plugin)',
                Accept: 'application/json'
            },
            throw: false
        });

        if (response.status !== 200) {
            throw new Error(`Manifest request for ${config.id} failed with status ${response.status}`);
        }

        if (!response.json) {
            throw new Error(`Manifest response for ${config.id} is empty`);
        }

        const manifest = response.json as ExternalIconManifest;
        return manifest;
    }

    private async downloadAssets(config: ExternalIconProviderConfig, manifest: ExternalIconManifest): Promise<IconAssetRecord> {
        const fontResponse = await requestUrl({
            url: manifest.font,
            method: 'GET',
            headers: {
                'User-Agent': 'NotebookNavigator/1.0 (Obsidian Plugin)'
            },
            throw: false
        });
        const metadataResponse = await requestUrl({
            url: manifest.metadata,
            method: 'GET',
            headers: {
                'User-Agent': 'NotebookNavigator/1.0 (Obsidian Plugin)',
                Accept: 'application/json'
            },
            throw: false
        });

        if (fontResponse.status !== 200) {
            throw new Error(`Font download for ${config.id} failed with status ${fontResponse.status}`);
        }

        if (metadataResponse.status !== 200) {
            throw new Error(`Metadata download for ${config.id} failed with status ${metadataResponse.status}`);
        }

        const fontData = fontResponse.arrayBuffer;
        const metadataRaw = metadataResponse.text;

        if (!fontData) {
            throw new Error(`Failed to download font for provider ${config.id}`);
        }

        if (!metadataRaw) {
            throw new Error(`Failed to download metadata for provider ${config.id}`);
        }

        return {
            id: config.id,
            version: manifest.version,
            fontMimeType: manifest.fontMimeType ?? 'font/woff2',
            fontData,
            metadataFormat: manifest.metadataFormat ?? 'json',
            metadataRaw,
            updatedAt: Date.now()
        };
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    private enqueue(task: () => Promise<void>): Promise<void> {
        const wrappedTask = async () => {
            await task();
        };
        const run = this.downloadChain.then(wrappedTask);
        this.downloadChain = run.then(() => undefined).catch(() => undefined);
        return run;
    }

    private requireProviderConfig(id: ExternalIconProviderId): ExternalIconProviderConfig {
        const config = EXTERNAL_ICON_PROVIDERS[id];
        if (!config) {
            throw new Error(`Unknown external icon provider: ${id}`);
        }
        return config;
    }
}
