import { convertToGrayscale } from "./grayscale";
import { ImageProcessingOptions } from "./webp-converter";

export type CanvasOutputType = "image/png" | "image/jpeg";

/**
 * Converts an image to PNG or JPEG using the Canvas API.
 * Reuses the same image loading, resizing, and grayscale pipeline as webp-converter.
 */
export async function convertImageWithCanvas(
  file: Blob,
  outputType: CanvasOutputType,
  options: ImageProcessingOptions
): Promise<Blob> {
  // Load image (createImageBitmap → <img> fallback)
  const bmp = await (async () => {
    try {
      // @ts-ignore (Electron/Obsidian environment)
      if (typeof createImageBitmap === "function") {
        return await createImageBitmap(file as any);
      }
      throw new Error("createImageBitmap unavailable");
    } catch {
      return await new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = URL.createObjectURL(file);
      });
    }
  })();

  // Resize
  let width = (bmp as any).width;
  let height = (bmp as any).height;
  if (options.enableResize && (width > options.maxWidth || height > options.maxHeight)) {
    const ar = width / height;
    if (width > height) {
      width = Math.min(width, options.maxWidth);
      height = Math.round(width / ar);
    } else {
      height = Math.min(height, options.maxHeight);
      width = Math.round(height * ar);
    }
  }

  // Canvas
  const canvas =
    typeof (window as any).OffscreenCanvas !== "undefined"
      ? new (window as any).OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = (canvas as any).getContext("2d");
  ctx.drawImage(bmp, 0, 0, width, height);

  // Grayscale conversion (if needed, apply before exporting)
  if (options.enableGrayscale) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const rgba = imageData.data instanceof Uint8ClampedArray
      ? new Uint8Array(imageData.data.buffer)
      : (imageData.data as Uint8Array);
    const grayscaled = convertToGrayscale(rgba);
    const newImageData = new ImageData(new Uint8ClampedArray(grayscaled.buffer as ArrayBuffer), width, height);
    ctx.putImageData(newImageData, 0, 0);
  }

  // Export using Canvas API
  const quality = outputType === "image/jpeg" ? options.quality : undefined;

  if (typeof canvas.convertToBlob === "function") {
    // OffscreenCanvas
    return await canvas.convertToBlob({ type: outputType, quality });
  } else {
    // HTMLCanvasElement
    return await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob returned null"));
        },
        outputType,
        quality
      );
    });
  }
}
