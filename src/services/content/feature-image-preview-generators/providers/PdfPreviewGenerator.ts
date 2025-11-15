/*
 * Notebook Navigator Ex - Plugin for Obsidian
 * Copyright (c) 2025 Pavel Sapehin
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { App, loadPdfJs, TFile } from "obsidian";
import { EMPTY_FUNC } from "src/utils/empty";
import { canvasToPngBlob } from "../ImageCropUtils";
import { ProviderPreviewResult } from "../PreviewGenerator";

import type * as pdfjslib from "pdfjs-dist";
import type { DocumentInitParameters, PDFDocumentLoadingTask, PDFPageProxy, PDFWorker } from "pdfjs-dist/types/src/display/api";

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

    private constructor(workerInit: () => PDFWorker) {
        this.activeWorker = workerInit()
    }

    public static async init(workerInit: () => PDFWorker): Promise<WorkerController> {
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

const getActiveWorker = async (workerInit: () => PDFWorker) => {
    if (activeWorker == null || activeWorker.isDestroyed) {
        activeWorker = await WorkerController.init(workerInit)
    }

    return activeWorker
}

export async function generatePdfPreview(pdfFile: TFile, app: App): Promise<ProviderPreviewResult> {
    const pdfjs: typeof pdfjslib = await loadPdfJs()
    const controller: WorkerController = await getActiveWorker(() => pdfjs.PDFWorker.create({}))
    controller.cancelAutoDispose()

    const params: DocumentInitParameters = {
        url: app.vault.getResourcePath(pdfFile),
        worker: controller.worker
    }

    let doc: PDFDocumentLoadingTask | undefined
    let page: PDFPageProxy | undefined

    try {
        const doc = await pdfjs.getDocument(params).promise

        // Add support for passing a custom page via a link name?
        // Add detection of white/empty pages?
        page = await doc.getPage(1)
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