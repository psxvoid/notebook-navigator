import { App } from "obsidian";
import smartcrop from "smartcrop";

export async function readSourceImageBlob(imagePath: string, app: App): Promise<Blob> {
    const imageBuffer: ArrayBuffer = await app.vault.adapter.readBinary(imagePath);

    if (imagePath.endsWith('.svg')) {
        return new Blob([imageBuffer], {
            type: 'image/svg+xml;charset=utf-8'
        })
    }

    return new Blob([imageBuffer]);
}

export function blobToBase64Url(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function () {
            const dataUrl = reader.result

            if (typeof dataUrl !== 'string') {
                reject("Unable to parse the result (not a string).")
                return
            }

            resolve(dataUrl);
        };

        reader.onerror = function (e) {
            reject(`Reader error: ${e}`)
        }

        reader.readAsDataURL(blob);
    });
};

export async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
    const img = new Image();

    img.src = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e, status) => {
            reject(status ?? e);
        }
    });

    return img;
};

export async function autoCrop(blob: Blob, maxSizeSquarePx: number): Promise<Blob> {
    const image = await blobToImage(blob);

    // Review: Refactoring: respect "forceSquareFeatureImage" option in settings
    const result = await smartcrop.crop(image, { width: maxSizeSquarePx, height: maxSizeSquarePx });
    const { x, y, width, height } = result.topCrop;

    const canvas = document.createElement('canvas');
    canvas.width = maxSizeSquarePx;
    canvas.height = maxSizeSquarePx;
    const ctx = canvas.getContext('2d');

    if (ctx == null) {
        throw new Error("Unable to get 2D context from canvas.")
    }

    ctx.drawImage(image, x, y, width, height, 0, 0, maxSizeSquarePx, maxSizeSquarePx);

    return new Promise((resolve, reject) => {
        canvas.toBlob((result: Blob | null) => {
            if (result == null) {
                reject("Unable to render blob to canvas.")
                return
            }

            resolve(result)
        }, 'image/png')
    });
}