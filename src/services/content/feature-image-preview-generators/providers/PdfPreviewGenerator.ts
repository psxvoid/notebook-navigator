import { App, TFile } from "obsidian";
import { EMPTY_FUNC } from "src/utils/empty";
import * as pdfjs from "pdfjs-dist";
import { PDFDocumentProxy,  PDFPageProxy, PDFWorker } from "pdfjs-dist";
import { DocumentInitParameters } from "pdfjs-dist/types/src/display/api";
import { canvasToPngBlob } from "../ImageCropUtils";

import "pdfjs-dist/build/pdf.worker.mjs";
import { ProviderPreviewResult } from "../PreviewGenerator";

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

export async function generatePdfPreview(pdfFile: TFile, app: App): Promise<ProviderPreviewResult> {
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