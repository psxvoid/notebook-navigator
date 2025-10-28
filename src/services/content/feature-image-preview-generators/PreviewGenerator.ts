import { App, TFile } from "obsidian";
import { getDBInstance } from "src/storage/fileOperations";
import { EMPTY_STRING } from "src/utils/empty";

export const cacheDirPath = `thumbnails/full`
export const cacheFilePath = (excalidrawFile: TFile) => `${cacheDirPath}/${excalidrawFile.basename}_${excalidrawFile.stat.size}.png`
export const isCachePath = (path: string | unknown) => typeof path === 'string'
    ? path.startsWith(cacheDirPath)
    : false

export interface GeneratePreviewResult {
    blob: Blob,
    dispose: () => void
}

type PreviewProviderGen = (file: TFile, app: App) => Promise<GeneratePreviewResult>;

export async function generatePreview(providerFile: TFile, app: App, consumerFile: TFile, generate: PreviewProviderGen): Promise<{ featurePath: string, featureProviderPath?: string, consumerTargetPath?: string } | null> {
    const previewFilePath = cacheFilePath(providerFile);
    const dbFile = getDBInstance().getFile(consumerFile.path);
    const currentFeature: string | null | undefined = dbFile?.featureImage

    const hasExistingFeature = (currentFeature ?? EMPTY_STRING).length > 0;

    if (hasExistingFeature && currentFeature === previewFilePath) {
        return { featurePath: previewFilePath, featureProviderPath: providerFile.path };
    }

    if (hasExistingFeature && isCachePath(currentFeature) && await this.app.vault.adapter.exists(currentFeature) ) {
        const previewAbstractFile = this.app.vault.getFileByPath(currentFeature)

        await this.app.vault.delete(previewAbstractFile);
    } else if (!(await this.app.vault.adapter.exists(cacheDirPath))) {
        await this.app.vault.adapter.mkdir(cacheDirPath);
    }

    let previewData: GeneratePreviewResult | undefined

    try {
        previewData = await generate(providerFile, app);
        await this.app.vault.createBinary(previewFilePath, await previewData.blob.arrayBuffer());
        return { featurePath: previewFilePath, featureProviderPath: providerFile.path, consumerTargetPath: providerFile.path }
    } catch(e: unknown) {
        if (e instanceof Error && e.message.indexOf("File already exists") >= 0) {
            // usually should not happen but just in case
            return { featurePath: previewFilePath, featureProviderPath: providerFile.path, consumerTargetPath: providerFile.path }
        }

        throw e;
    } finally {
        previewData?.dispose()
    }
}