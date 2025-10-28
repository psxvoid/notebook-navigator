import { App, TFile } from "obsidian";
import { getDBInstance } from "src/storage/fileOperations";
import { EMPTY_FUNC, EMPTY_STRING } from "src/utils/empty";
import { readSourceImageBlob } from "./ImageCropUtils";

export const cacheDirPath = `thumbnails/full`
export const cacheFilePath = (excalidrawFile: TFile) => `${cacheDirPath}/${excalidrawFile.basename}_${excalidrawFile.stat.size}.png`
export const isCachePath = (path: string | unknown) => typeof path === 'string'
    ? path.startsWith(cacheDirPath)
    : false

// TODO: Rename to ProviderPreviewResult
export interface GeneratePreviewResult {
    blob: Blob,
    dispose: () => void
}

// TODO: Rename to GeneratePreviewResult
export interface GeneratePreviewResultEx {
    featurePath: string,
    featureProviderPath?: string,
    consumerTargetPath?: string,
    previewBlob?: Blob,
}

// TODO: use settings
export const savePreviewFileToDisk = true

type PreviewProviderGen = (file: TFile, app: App) => Promise<GeneratePreviewResult>;

export async function generatePreview(providerFile: TFile, app: App, consumerFile: TFile, generate: PreviewProviderGen): Promise<GeneratePreviewResultEx | null> {
    const previewFilePath = cacheFilePath(providerFile);
    const dbFile = getDBInstance().getFile(consumerFile.path);
    const currentFeature: string | null | undefined = dbFile?.featureImage

    const hasExistingFeature = (currentFeature ?? EMPTY_STRING).length > 0;

    if (hasExistingFeature && currentFeature === previewFilePath) {
        return { featurePath: previewFilePath, featureProviderPath: providerFile.path };
    }

    if (savePreviewFileToDisk && hasExistingFeature && isCachePath(currentFeature) && await this.app.vault.adapter.exists(currentFeature)) {
        const previewAbstractFile = this.app.vault.getFileByPath(currentFeature)

        await this.app.vault.delete(previewAbstractFile);
    } else if (savePreviewFileToDisk && !(await this.app.vault.adapter.exists(cacheDirPath))) {
        await this.app.vault.adapter.mkdir(cacheDirPath);
    }

    let previewData: GeneratePreviewResult | undefined
    try {
        // TODO: Remove dispose?
        const exists = (savePreviewFileToDisk && await app.vault.adapter.exists(previewFilePath))

        previewData = exists === true
            ? { blob: await readSourceImageBlob(previewFilePath, app, 'image/png'), dispose: EMPTY_FUNC }
            : await generate(providerFile, app);

        if (savePreviewFileToDisk && !exists) {
            await this.app.vault.createBinary(previewFilePath, await previewData.blob.arrayBuffer());
        }

        return {
            featurePath: previewFilePath,
            featureProviderPath: providerFile.path,
            consumerTargetPath: providerFile.path,
            previewBlob: previewData.blob
        }
    } catch (e: unknown) {
        if (e instanceof Error && e.message.indexOf("File already exists") >= 0) {
            // usually should not happen but just in case
            return { featurePath: previewFilePath, featureProviderPath: providerFile.path, consumerTargetPath: providerFile.path }
        }

        throw e;
    } finally {
        previewData?.dispose()
    }
}