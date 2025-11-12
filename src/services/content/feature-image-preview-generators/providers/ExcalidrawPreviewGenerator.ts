import { LinkCache, CachedMetadata, EmbedCache, TFile, App } from "obsidian";
import { ProviderPreviewResult } from "../PreviewGenerator";

interface SceneElements {
    [key: string]: unknown
}

interface ExcalidrawScene {
    elements: { [key: string]: unknown }
}

interface ElementsDictImage {
    type: string,
    fileId: string,
    width: number,
    height: number
}

interface FrameRenderingOptions {
    enabled: boolean;
    name: boolean;
    outline: boolean;
    clip: boolean;
}

interface ExportSettings {
    withBackground: boolean;
    withTheme: boolean;
    isMask: boolean;
    frameRendering?: FrameRenderingOptions; //optional, overrides relevant appState settings for rendering the frame
    skipInliningFonts?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface EmbeddedFilesLoader {
}

const exportSettings: ExportSettings = {
    frameRendering: {
        enabled: false,
        name: false,
        outline: false,
        clip: false
    },
    withBackground: true,
    withTheme: true,
    isMask: false
}

interface ExcalidrawAutomateGlobal {
    elementsDict: readonly ElementsDictImage[]
    imagesDict: { [key: string]: unknown }
    getAPI(): ExcalidrawAutomateGlobal & {
        getSceneFromFile(excalidrawFile: TFile): ExcalidrawScene;
        copyViewElementsToEAforEditing(scene: SceneElements, copyImages?: boolean): unknown;
        createPNG(
            templatePath?: string,
            scale?: number,
            exportSettings?: ExportSettings,
            loader?: EmbeddedFilesLoader,
            theme?: string,
            padding?: number,
        ): Promise<Blob>
        destroy(): void
    }
}

declare global {
    const ExcalidrawAutomate: ExcalidrawAutomateGlobal
}

function getExcalidrawAttachmentType(outlink: LinkCache, metadata: CachedMetadata | null) {
    const frontMatter = outlink != null && outlink.link != null ? metadata?.frontmatter ?? {} : {};

    function hasExcalidrawType(value: 'parsed' | 'raw') {
        return frontMatter['excalidraw-plugin'] === value ? value : ''
    }

    return hasExcalidrawType('parsed') || hasExcalidrawType('raw')
}

async function getEmbedLinkFileId(lines: readonly string[], outlink: EmbedCache) {
    const linesWithLink = lines.filter(x => x.indexOf(outlink.link ?? '') >= 0)
    //# Embedded files
    // 4d12435ada81c2e3600f6fc5b4db4fd56b63261c: [[other/trash-notes/To Do/unknown_filename.1.png]]
    return linesWithLink.map(lineWithLink => {
        const matches = /^(.*?):/g.exec(lineWithLink)

        return matches != null && matches.length > 1
            ? matches[1]
            : null
    }).filter(x => x != null)
}

export interface ToDataUriResult {
    objectURL?: string
    excalidrawPngBlob?: Blob,
    dispose: () => void,
}

const EMPTY_DISPOSE = function emptyDispose() { }
const EMPTY_TO_DATA_URI_RESULT = { dispose: EMPTY_DISPOSE }

async function toDataURI(tFile: TFile, outlink: LinkCache, params: { width: number, height: number }, app: App): Promise<ToDataUriResult> {
    if (tFile == null) {
        return EMPTY_TO_DATA_URI_RESULT;
    }

    const metadata: CachedMetadata | null = this.app.metadataCache.getFileCache(tFile);

    let previewPngBlob: ProviderPreviewResult | undefined
    if (getExcalidrawAttachmentType(outlink, metadata) === 'raw') {
        previewPngBlob = await generatePreview(tFile, true, app)
    } else if (getExcalidrawAttachmentType(outlink, metadata) === 'parsed') {
        previewPngBlob = await generatePreview(tFile, false, app)
    }

    if (previewPngBlob) {
        const imageSource = URL.createObjectURL(previewPngBlob.blob);

        return {
            objectURL: imageSource,
            excalidrawPngBlob: previewPngBlob.blob,
            dispose: () => {
                URL.revokeObjectURL(imageSource)
                previewPngBlob.dispose()
            }
        }
    }

    const imgHtml = `<img src="${app.vault.getResourcePath(tFile)}" />`
    const tmpEl = document.createElement('div')
    // eslint-disable-next-line @microsoft/sdl/no-inner-html
    tmpEl.innerHTML = imgHtml
    const imgEl = tmpEl.children[0] as HTMLImageElement

    await new Promise<void>((resolve, reject) => {
        imgEl.onload = () => resolve();
        imgEl.onerror = (e) => reject(e);
    });

    const canvas = document.createElement('canvas')
    canvas.width = params.width
    canvas.height = params.height

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(imgEl, 0, 0);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob: Blob | null) => {
            if (blob == null) {
                reject(`Unable to create image preview for "${tFile.path}"`);
                return;
            }

            resolve(blob)
        }, "image/png")
    });

    const objectURL = URL.createObjectURL(pngBlob);

    return { objectURL, dispose: () => URL.revokeObjectURL(objectURL) }
}

// defensive programming: ensure that it has the correct shape
function isValidElementsDictEntry(value?: [id?: string, image?: ElementsDictImage]): value is [id: string, image: ElementsDictImage] {
    return value != null && value instanceof Array && typeof value[1]?.type === 'string'
}

export type Dispose = () => void;
export type DisposeArray = Dispose[];

async function loadEmbeddedOutlinksForExcalidraw(ea: ExcalidrawAutomateGlobal, excalidrawFile: TFile, app: App): Promise<Dispose> {
    const outlinks = this.app.metadataCache.getFileCache(excalidrawFile)?.links as LinkCache[];

    if (outlinks == null || outlinks.length === 0) return EMPTY_DISPOSE;

    const sceneImages = Object.entries(ea.elementsDict ?? []).filter(x => isValidElementsDictEntry(x) && x[1].type === 'image')

    if (sceneImages.length === 0) return EMPTY_DISPOSE;

    const content = await this.app.vault.read(excalidrawFile);
    const lines = content.split('\n')
    const disposeFuncs: DisposeArray = []

    await Promise.all(outlinks.map(async (outlink: LinkCache) => {
        const fileIds = await getEmbedLinkFileId(lines, outlink);
        const maybeFileParam = sceneImages.find(x => fileIds.indexOf(x[1].fileId) >= 0)

        if (maybeFileParam == null) return

        const fileParams = maybeFileParam[1] as { fileId: string, width: number, height: number }
        const fileId = fileParams.fileId

        const embedPath = outlink.link;
        const embedFile = this.app.metadataCache.getFirstLinkpathDest(embedPath, excalidrawFile.path);

        const imageData: ToDataUriResult = await toDataURI(embedFile, outlink, fileParams, app);

        // monkey-patch the images dict to make ExcalidrawAutomate believe
        // that images are loaded and ready to render
        ea.imagesDict[fileId] = {
            "mimeType": "image/png",
            "id": fileId,
            "dataURL": imageData.objectURL,
            "created": 1714630882281,
            "isHyperLink": true,
            "hyperlink": outlink.link,
            "file": null,
            "hasSVGwithBitmap": false,
            "latex": null
        }

        disposeFuncs.push(imageData.dispose);
    }));

    return () => {
        for (const disposeFunc of disposeFuncs) {
            disposeFunc()
        }
    }
}


export async function generatePreview(excalidrawFile: TFile, loadRaw: boolean, app: App): Promise<ProviderPreviewResult> {
    // eslint-disable-next-line no-undef
    const ea = ExcalidrawAutomate.getAPI();

    const scene = await ea.getSceneFromFile(excalidrawFile)

    async function createNewBlobResult(dispose?: Dispose): Promise<ProviderPreviewResult> {
        // the frame around the preview is still rendered if padding=0 is not provided
        return {
            blob: await ea.createPNG(undefined, 1, exportSettings, undefined, undefined, 0),
            dispose: () => { ea.destroy(); (dispose ?? EMPTY_DISPOSE)(); }
        }
    }

    if (loadRaw) {
        await ea.copyViewElementsToEAforEditing(scene.elements, true)
        return createNewBlobResult()
    }

    await ea.copyViewElementsToEAforEditing(scene.elements)

    const dispose = await loadEmbeddedOutlinksForExcalidraw(ea, excalidrawFile, app)

    return createNewBlobResult(dispose)
}

export async function generateExcalidrawPreview(excalidrawFile: TFile, app: App): Promise<ProviderPreviewResult> {
    return generatePreview(excalidrawFile, false, app)
}