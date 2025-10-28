import { App, TFile } from "obsidian";
import { getDBInstance } from "src/storage/fileOperations";
import { cacheDirPath, cacheFilePath, GeneratePreviewResult, isCachePath } from "./ExcalidrawPreviewGenerator";
import { EMPTY_FUNC, EMPTY_STRING } from "src/utils/empty";
import * as pdfjs from "pdfjs-dist";
import { PDFDocumentProxy,  PDFPageProxy, PDFWorker } from "pdfjs-dist";
import { DocumentInitParameters } from "pdfjs-dist/types/src/display/api";
import { canvasToPngBlob } from "./ImageCropUtils";

// import * as WorkerPort from "pdfjs-dist/build/pdf.worker.mjs";
// pdfjs.GlobalWorkerOptions.workerPort = new WorkerPort.WorkerMessageHandler() as Worker

// import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";
// pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs";
// pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// import workerSrc from 'pdfjs-dist/build/pdf.worker?worker&url'
// pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

import "pdfjs-dist/build/pdf.worker.mjs";
// import workerSrc from 'pdfjs-dist/build/pdf.worker?worker&url'
// pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

class WorkerController {
    private activeWorker: PDFWorker
    private initialized: boolean = false;
    private workerDisposeTimeout: ReturnType<typeof setTimeout>

    public get isInitialized(): boolean {
        return this.initialized
    }

    public get worker(): PDFWorker {
        if (this.activeWorker.destroyed || this.initialized !== true) {
            throw new Error('The worker is already destroyed or not initialized.')
        }

        return this.activeWorker
    }

    public get isDestroyed(): boolean {
        return this.activeWorker.destroyed
    }

    private constructor(workerInit?: () => PDFWorker) {
        this.activeWorker = (workerInit ?? (() => new PDFWorker()))()
    }

    public static async init(workerInit?: () => PDFWorker): Promise<WorkerController> {
        const instance = new WorkerController(workerInit)
        await instance.activeWorker.promise
        instance.initialized = true
        return instance
    }

    cancelAutoDispose(): void {
        if (this.activeWorker.destroyed) {
            throw new Error("The worker is already destroyed")
        }

        clearTimeout(this.workerDisposeTimeout)
    }

    enableAutoDispose(timeoutMs: number): void {
        clearTimeout(this.workerDisposeTimeout)

        this.workerDisposeTimeout = setTimeout(() => {
            this.activeWorker?.destroy()
        }, timeoutMs)
    }

    destroy(): void {
        this.cancelAutoDispose()

        if (!this.activeWorker.destroyed) {
            this.activeWorker.destroy()
        }
    }
}

let activeWorker: WorkerController | undefined

const getActiveWorker = async () => {
    if (activeWorker == null || activeWorker.isDestroyed) {
        activeWorker = await WorkerController.init()
    }

    return activeWorker
}

async function generatePreview(pdfFile: TFile, app: App): Promise<GeneratePreviewResult> {
    const controller: WorkerController = await getActiveWorker()
    controller.cancelAutoDispose()

    const params: DocumentInitParameters = {
        url: app.vault.getResourcePath(pdfFile),
        worker: controller.worker
    }

    let doc: PDFDocumentProxy | undefined
    let page: PDFPageProxy | undefined

    try {
        doc = await pdfjs.getDocument(params).promise

        // Add support for passing a custom page via a link name?
        // Add detection of white/empty pages?
        const page = await doc.getPage(1)
        const viewport = page.getViewport({ scale: 1.0 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext('2d');

        if (ctx == null) {
            throw new Error("Unable to get 2D context from canvas.")
        }

        await page.render({ canvasContext: ctx, canvas, viewport }).promise

        return {
            blob: await canvasToPngBlob(canvas),
            dispose: EMPTY_FUNC,
        }
    } finally {
        controller.enableAutoDispose(1 * 60 * 1000)
        page?.cleanup()
        doc?.destroy()
    }
}

// TODO: extract into a common function
export async function generatePdfPreview(pdfFile: TFile, app: App, requestingFile: TFile): Promise<{ featurePath: string, featureProviderPath?: string, consumerTargetPath?: string } | null> {
    const previewFilePath = cacheFilePath(pdfFile);
    const dbFile = getDBInstance().getFile(pdfFile.path)
    const currentFeature: string | null | undefined = dbFile?.featureImage

    const hasExistingFeature = (currentFeature ?? EMPTY_STRING).length > 0;

    if (hasExistingFeature && currentFeature === previewFilePath) {
        return { featurePath: previewFilePath, featureProviderPath: pdfFile.path };
    }

    if (hasExistingFeature && isCachePath(currentFeature) && await this.app.vault.adapter.exists(currentFeature)) {
        const previewAbstractFile = this.app.vault.getFileByPath(currentFeature)

        await this.app.vault.delete(previewAbstractFile);
    } else if (!(await this.app.vault.adapter.exists(cacheDirPath))) {
        await this.app.vault.adapter.mkdir(cacheDirPath);
    }

    let previewData: GeneratePreviewResult | undefined
    try {
        previewData = await generatePreview(pdfFile, app);
        await this.app.vault.createBinary(previewFilePath, await previewData.blob.arrayBuffer());
        return { featurePath: previewFilePath, featureProviderPath: pdfFile.path, consumerTargetPath: pdfFile.path }
    } catch (e: unknown) {
        if (e instanceof Error && e.message.indexOf("File already exists") >= 0) {
            // usually should not happen but just in case
            return { featurePath: previewFilePath, featureProviderPath: pdfFile.path, consumerTargetPath: pdfFile.path }
        }

        throw e;
    } finally {
        previewData?.dispose()
    }
}
