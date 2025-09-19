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
        // TODO REMOVE
        console.log('[ExternalIconController] initialize invoked');
        if (this.isInitialized) {
            // TODO REMOVE
            console.log('[ExternalIconController] initialize skipped (already initialized)');
            return;
        }

        await this.database.init();
        // TODO REMOVE
        console.log('[ExternalIconController] database initialized');
        const records = await this.database.getAll();
        // TODO REMOVE
        console.log(`[ExternalIconController] loaded ${records.length} provider records from database`);
        records.forEach(record => {
            const id = record.id as ExternalIconProviderId;
            if (EXTERNAL_ICON_PROVIDERS[id]) {
                this.installedProviders.add(id);
                this.providerVersions.set(id, record.version);
                // TODO REMOVE
                console.log(`[ExternalIconController] Provider ${id} marked as installed from cache (version ${record.version})`);
            }
        });

        // TODO REMOVE
        console.log('[ExternalIconController] initialize completed');
        this.isInitialized = true;
    }

    dispose(): void {
        // TODO REMOVE
        console.log('[ExternalIconController] dispose invoked');
        this.activeProviders.forEach((entry, providerId) => {
            // TODO REMOVE
            console.log(`[ExternalIconController] Disposing active provider ${providerId}`);
            entry.provider.dispose?.();
        });
        this.activeProviders.clear();
        // TODO REMOVE
        console.log('[ExternalIconController] Active providers cleared');
        this.database.close();
        // TODO REMOVE
        console.log('[ExternalIconController] Database connection closed');
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
        // TODO REMOVE
        console.log(`[ExternalIconController] installProvider requested for ${id}`);
        await this.ensureInitialized();

        const existingTask = this.downloadTasks.get(id);
        if (existingTask) {
            // TODO REMOVE
            console.log(`[ExternalIconController] installProvider found existing task for ${id}`);
            return existingTask;
        }

        const task = this.enqueue(async () => {
            // TODO REMOVE
            console.log(`[ExternalIconController] installProvider task started for ${id}`);
            const config = this.requireProviderConfig(id);
            // TODO REMOVE
            console.log(`[ExternalIconController] Provider config loaded for ${id}`);

            try {
                const manifest = await this.fetchManifest(config);
                // TODO REMOVE
                console.log(`[ExternalIconController] Manifest fetched for ${id} (version ${manifest.version})`);
                const record = await this.downloadAssets(config, manifest);
                // TODO REMOVE
                console.log(`[ExternalIconController] Assets downloaded for ${id} (version ${record.version})`);

                await this.database.put(record);
                // TODO REMOVE
                console.log(`[ExternalIconController] Assets stored for ${id}`);
                this.installedProviders.add(id);
                this.providerVersions.set(id, record.version);
                // TODO REMOVE
                console.log(`[ExternalIconController] Provider ${id} marked installed (version ${record.version})`);

                if (options.persistSetting !== false) {
                    // TODO REMOVE
                    console.log(`[ExternalIconController] Persisting enabled setting for ${id}`);
                    this.markProviderSetting(id, true);
                }

                const activated = await this.activateIfEnabled(config, record);
                // TODO REMOVE
                console.log(`[ExternalIconController] Activation processed for ${id}`);

                if (options.persistSetting !== false) {
                    // TODO REMOVE
                    console.log('[ExternalIconController] Saving settings after install');
                    await this.settingsProvider.saveSettingsAndUpdate();
                } else if (activated) {
                    // TODO REMOVE
                    console.log('[ExternalIconController] Notifying listeners after install (no persistence)');
                    this.settingsProvider.notifySettingsUpdate();
                }
            } catch (error) {
                // TODO REMOVE
                console.log(`[ExternalIconController] installProvider task failed for ${id}`, error);
                throw error;
            }
        });

        this.downloadTasks.set(id, task);
        // TODO REMOVE
        console.log(`[ExternalIconController] installProvider task registered for ${id}`);
        try {
            await task;
            // TODO REMOVE
            console.log(`[ExternalIconController] installProvider task completed for ${id}`);
        } finally {
            this.downloadTasks.delete(id);
            // TODO REMOVE
            console.log(`[ExternalIconController] installProvider task cleaned up for ${id}`);
        }
    }

    async removeProvider(id: ExternalIconProviderId, options: RemoveOptions = {}): Promise<void> {
        // TODO REMOVE
        console.log(`[ExternalIconController] removeProvider requested for ${id}`);
        await this.ensureInitialized();

        const config = this.requireProviderConfig(id);
        // TODO REMOVE
        console.log(`[ExternalIconController] Provider config loaded for removal of ${id}`);

        // Wait for any in-flight download before removing
        const existingTask = this.downloadTasks.get(id);
        if (existingTask) {
            // TODO REMOVE
            console.log(`[ExternalIconController] Waiting for active install task before removing ${id}`);
            try {
                await existingTask;
                // TODO REMOVE
                console.log(`[ExternalIconController] Active install task completed before removal of ${id}`);
            } catch {
                // TODO REMOVE
                console.log(`[ExternalIconController] Active install task failed before removal of ${id}`);
                // ignore download failure when removing
            }
        }

        await this.enqueue(async () => {
            // TODO REMOVE
            console.log(`[ExternalIconController] removeProvider task started for ${id}`);
            const wasActive = this.deactivateProvider(config.id);
            // TODO REMOVE
            console.log(`[ExternalIconController] Provider ${id} deactivated`);
            await this.database.delete(config.id);
            // TODO REMOVE
            console.log(`[ExternalIconController] Provider ${id} deleted from database`);
            this.installedProviders.delete(config.id);
            this.providerVersions.delete(config.id);
            // TODO REMOVE
            console.log(`[ExternalIconController] Provider ${id} removed from installed cache`);

            if (options.persistSetting !== false) {
                // TODO REMOVE
                console.log(`[ExternalIconController] Persisting disabled setting for ${id}`);
                this.markProviderSetting(config.id, false);
                // TODO REMOVE
                console.log('[ExternalIconController] Saving settings after removal');
                await this.settingsProvider.saveSettingsAndUpdate();
            } else if (wasActive) {
                // TODO REMOVE
                console.log('[ExternalIconController] Notifying listeners after removal (no persistence)');
                this.settingsProvider.notifySettingsUpdate();
            }
        });
        // TODO REMOVE
        console.log(`[ExternalIconController] removeProvider task finished for ${id}`);
    }

    async syncWithSettings(): Promise<void> {
        // TODO REMOVE
        console.log('[ExternalIconController] syncWithSettings invoked');
        await this.ensureInitialized();
        const settings = this.settingsProvider.settings;

        if (!settings.useExternalIconProviders) {
            // TODO REMOVE
            console.log('[ExternalIconController] External providers disabled in settings; deactivating all active providers');
            // Unregister active providers but leave assets intact for next enable
            let changed = false;
            this.activeProviders.forEach((_, providerId) => {
                if (this.deactivateProvider(providerId)) {
                    changed = true;
                }
            });
            if (changed) {
                // TODO REMOVE
                console.log('[ExternalIconController] Notifying listeners after disabling all providers');
                this.settingsProvider.notifySettingsUpdate();
            }
            return;
        }

        const map = settings.externalIconProviders || {};
        const tasks: Promise<void>[] = [];
        let shouldNotifyAfterLoop = false;

        (Object.keys(EXTERNAL_ICON_PROVIDERS) as ExternalIconProviderId[]).forEach(id => {
            const shouldEnable = !!map[id];
            // TODO REMOVE
            console.log(`[ExternalIconController] syncWithSettings processing ${id}, shouldEnable=${shouldEnable}`);
            if (shouldEnable) {
                const config = this.requireProviderConfig(id);
                tasks.push(
                    this.ensureProviderAvailable(config, { persistSetting: false }).catch(error => {
                        // TODO REMOVE
                        console.log(`[ExternalIconController] Failed to ensure provider ${id} is available`, error);
                        console.error(`[IconProviders] Failed to initialize provider ${id}:`, error);
                    })
                );
            } else {
                // TODO REMOVE
                console.log(`[ExternalIconController] syncWithSettings deactivating ${id}`);
                if (this.deactivateProvider(id)) {
                    shouldNotifyAfterLoop = true;
                }
            }
        });

        await Promise.all(tasks);
        // TODO REMOVE
        console.log('[ExternalIconController] syncWithSettings completed');

        if (shouldNotifyAfterLoop) {
            // TODO REMOVE
            console.log('[ExternalIconController] Notifying listeners after provider deactivation');
            this.settingsProvider.notifySettingsUpdate();
        }
    }

    private async ensureProviderAvailable(config: ExternalIconProviderConfig, options: InstallOptions): Promise<void> {
        // TODO REMOVE
        console.log(`[ExternalIconController] ensureProviderAvailable invoked for ${config.id}`);
        if (!this.isProviderInstalled(config.id)) {
            // TODO REMOVE
            console.log(`[ExternalIconController] ${config.id} not installed; installing`);
            await this.installProvider(config.id, options);
            return;
        }

        const record = await this.database.get(config.id);
        if (!record) {
            // TODO REMOVE
            console.log(`[ExternalIconController] Missing database record for ${config.id}; reinstalling`);
            this.installedProviders.delete(config.id);
            this.providerVersions.delete(config.id);
            await this.installProvider(config.id, options);
            return;
        }

        this.providerVersions.set(config.id, record.version);
        // TODO REMOVE
        console.log(`[ExternalIconController] Database record found for ${config.id} (version ${record.version}); activating if enabled`);
        const activated = await this.activateIfEnabled(config, record);
        if (activated && options.persistSetting === false) {
            // TODO REMOVE
            console.log('[ExternalIconController] Notifying listeners after activation from cache');
            this.settingsProvider.notifySettingsUpdate();
        }
    }

    private markProviderSetting(id: ExternalIconProviderId, enabled: boolean): void {
        // TODO REMOVE
        console.log(`[ExternalIconController] markProviderSetting called for ${id} => ${enabled}`);
        const { settings } = this.settingsProvider;
        if (!settings.externalIconProviders) {
            // TODO REMOVE
            console.log('[ExternalIconController] Initializing externalIconProviders map on settings');
            settings.externalIconProviders = {};
        }
        settings.externalIconProviders[id] = enabled;
        // TODO REMOVE
        console.log(`[ExternalIconController] externalIconProviders[${id}] set to ${enabled}`);
    }

    private deactivateProvider(id: ExternalIconProviderId): boolean {
        // TODO REMOVE
        console.log(`[ExternalIconController] deactivateProvider called for ${id}`);
        const entry = this.activeProviders.get(id);
        let changed = false;
        if (entry) {
            // TODO REMOVE
            console.log(`[ExternalIconController] Disposing provider instance for ${id}`);
            entry.provider.dispose?.();
            this.activeProviders.delete(id);
            // TODO REMOVE
            console.log(`[ExternalIconController] Provider ${id} removed from active cache`);
            changed = true;
        }
        this.iconService.unregisterProvider(id);
        // TODO REMOVE
        console.log(`[ExternalIconController] Provider ${id} unregistered from icon service`);
        return changed;
    }

    private async activateIfEnabled(config: ExternalIconProviderConfig, record: IconAssetRecord): Promise<boolean> {
        // TODO REMOVE
        console.log(`[ExternalIconController] activateIfEnabled called for ${config.id}`);
        const settings = this.settingsProvider.settings;
        if (!settings.useExternalIconProviders) {
            // TODO REMOVE
            console.log('[ExternalIconController] Global external icon providers disabled; skipping activation');
            return false;
        }
        if (!settings.externalIconProviders || !settings.externalIconProviders[config.id]) {
            // TODO REMOVE
            console.log(`[ExternalIconController] Provider ${config.id} not enabled in settings; skipping activation`);
            return false;
        }

        const activeEntry = this.activeProviders.get(config.id);
        if (activeEntry && activeEntry.version === record.version) {
            // TODO REMOVE
            console.log(
                `[ExternalIconController] Provider ${config.id} already active with matching version ${record.version}; nothing to do`
            );
            return false;
        }

        if (activeEntry) {
            // TODO REMOVE
            console.log(
                `[ExternalIconController] Provider ${config.id} active with version ${activeEntry.version}; reloading with ${record.version}`
            );
            this.deactivateProvider(config.id);
        }

        const provider = this.createProvider(config, record);
        if (!provider) {
            // TODO REMOVE
            console.log(`[ExternalIconController] Provider factory returned null for ${config.id}`);
            console.warn(`[IconProviders] Provider ${config.id} could not be created.`);
            return false;
        }

        this.iconService.registerProvider(provider);
        // TODO REMOVE
        console.log(`[ExternalIconController] Provider ${config.id} registered with icon service`);
        this.activeProviders.set(config.id, { provider, version: record.version });
        // TODO REMOVE
        console.log(`[ExternalIconController] Provider ${config.id} cached as active (version ${record.version})`);
        return true;
    }

    private createProvider(config: ExternalIconProviderConfig, record: IconAssetRecord): (IconProvider & { dispose?: () => void }) | null {
        // TODO REMOVE
        console.log(`[ExternalIconController] createProvider called for ${config.id}`);
        switch (config.id) {
            case 'fontawesome-regular':
                // TODO REMOVE
                console.log('[ExternalIconController] Creating FontAwesome provider instance');
                return new FontAwesomeIconProvider({
                    record,
                    fontFamily: config.fontFamily
                });
            case 'rpg-awesome':
                // TODO REMOVE
                console.log('[ExternalIconController] Creating RPG Awesome provider instance');
                return new RpgAwesomeIconProvider({
                    record,
                    fontFamily: config.fontFamily
                });
            default:
                // TODO REMOVE
                console.log(`[ExternalIconController] Unknown provider id ${config.id}; returning null`);
                return null;
        }
    }

    private async fetchManifest(config: ExternalIconProviderConfig): Promise<ExternalIconManifest> {
        // TODO REMOVE
        console.log(`[ExternalIconController] fetchManifest started for ${config.id} (${config.manifestUrl})`);
        const response = await requestUrl({
            url: config.manifestUrl,
            method: 'GET',
            headers: {
                'User-Agent': 'NotebookNavigator/1.0 (Obsidian Plugin)',
                Accept: 'application/json'
            },
            throw: false
        });
        // TODO REMOVE
        console.log(
            `[ExternalIconController] fetchManifest response for ${config.id}: status=${response.status}, headers=${JSON.stringify(response.headers)}`
        );

        if (response.status !== 200) {
            // TODO REMOVE
            console.log(
                `[ExternalIconController] fetchManifest unexpected status for ${config.id}: status=${response.status}, bodyLength=${response.text?.length ?? 0}`
            );
            throw new Error(`Manifest request for ${config.id} failed with status ${response.status}`);
        }

        if (!response.json) {
            throw new Error(`Manifest response for ${config.id} is empty`);
        }

        const manifest = response.json as ExternalIconManifest;
        // TODO REMOVE
        console.log(`[ExternalIconController] fetchManifest completed for ${config.id} (version ${manifest.version})`);
        return manifest;
    }

    private async downloadAssets(config: ExternalIconProviderConfig, manifest: ExternalIconManifest): Promise<IconAssetRecord> {
        // TODO REMOVE
        console.log(`[ExternalIconController] downloadAssets started for ${config.id}`);
        const fontResponse = await requestUrl({
            url: manifest.font,
            method: 'GET',
            headers: {
                'User-Agent': 'NotebookNavigator/1.0 (Obsidian Plugin)'
            },
            throw: false
        });
        // TODO REMOVE
        console.log(`[ExternalIconController] Font response received for ${config.id} with status ${fontResponse.status}`);
        const metadataResponse = await requestUrl({
            url: manifest.metadata,
            method: 'GET',
            headers: {
                'User-Agent': 'NotebookNavigator/1.0 (Obsidian Plugin)',
                Accept: 'application/json'
            },
            throw: false
        });
        // TODO REMOVE
        console.log(`[ExternalIconController] Metadata response received for ${config.id} with status ${metadataResponse.status}`);

        if (fontResponse.status !== 200) {
            // TODO REMOVE
            console.log(
                `[ExternalIconController] Font download failed for ${config.id} with status ${fontResponse.status}, bodyLength=${fontResponse.arrayBuffer ? fontResponse.arrayBuffer.byteLength : 0}`
            );
            throw new Error(`Font download for ${config.id} failed with status ${fontResponse.status}`);
        }

        if (metadataResponse.status !== 200) {
            // TODO REMOVE
            console.log(
                `[ExternalIconController] Metadata download failed for ${config.id} with status ${metadataResponse.status}, bodyLength=${metadataResponse.text ? metadataResponse.text.length : 0}`
            );
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

        // TODO REMOVE
        console.log(`[ExternalIconController] downloadAssets completed for ${config.id}`);
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
            // TODO REMOVE
            console.log('[ExternalIconController] ensureInitialized detected uninitialized state; initializing now');
            await this.initialize();
        } else {
            // TODO REMOVE
            console.log('[ExternalIconController] ensureInitialized confirmed controller already initialized');
        }
    }

    private enqueue(task: () => Promise<void>): Promise<void> {
        // TODO REMOVE
        console.log('[ExternalIconController] enqueue called');
        const wrappedTask = async () => {
            // TODO REMOVE
            console.log('[ExternalIconController] enqueue task execution start');
            await task();
            // TODO REMOVE
            console.log('[ExternalIconController] enqueue task execution end');
        };
        const run = this.downloadChain.then(wrappedTask);
        this.downloadChain = run.then(() => undefined).catch(() => undefined);
        // TODO REMOVE
        console.log('[ExternalIconController] enqueue scheduled task');
        return run;
    }

    private requireProviderConfig(id: ExternalIconProviderId): ExternalIconProviderConfig {
        // TODO REMOVE
        console.log(`[ExternalIconController] requireProviderConfig called for ${id}`);
        const config = EXTERNAL_ICON_PROVIDERS[id];
        if (!config) {
            throw new Error(`Unknown external icon provider: ${id}`);
        }
        // TODO REMOVE
        console.log(`[ExternalIconController] requireProviderConfig resolved config for ${id}`);
        return config;
    }
}
