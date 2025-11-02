import { App, loadPdfJs, TFile } from "obsidian";
import { EMPTY_FUNC } from "src/utils/empty";
import * as pdfjslib from "pdfjs-dist";
import { DocumentInitParameters } from "pdfjs-dist/types/src/display/api";
import { canvasToPngBlob } from "../ImageCropUtils";

import { ProviderPreviewResult } from "../PreviewGenerator";

export async function generatePdfPreview(pdfFile: TFile, app: App): Promise<ProviderPreviewResult> {
    const params: DocumentInitParameters = {
        url: app.vault.getResourcePath(pdfFile),
    }

    const pdfjs: typeof pdfjslib = await loadPdfJs()

    const doc = await pdfjs.getDocument(params).promise

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
}