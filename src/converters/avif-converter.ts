import avifEncode, { init as initAvifEncode } from "@jsquash/avif/encode";
import { convertToGrayscale } from "./grayscale";
import { getAvifWasmModule } from "./avif-wasm-loader";
import { ImageProcessingOptions } from "./webp-converter";

let initialized = false;

/**
 * Converts an image to AVIF using the @jsquash/avif WASM encoder.
 * On first call, downloads the WASM module if not cached locally.
 */
export async function convertImageToAVIF(
  file: Blob,
  options: ImageProcessingOptions
): Promise<Blob> {
  // Ensure WASM is loaded and initialized
  if (!initialized) {
    const wasmModule = await getAvifWasmModule();
    await initAvifEncode(wasmModule);
    initialized = true;
  }

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

  // Canvas → RGBA
  const canvas =
    typeof (window as any).OffscreenCanvas !== "undefined"
      ? new (window as any).OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = (canvas as any).getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  let rgba = data instanceof Uint8ClampedArray ? new Uint8Array(data.buffer) : (data as Uint8Array);

  // Grayscale
  if (options.enableGrayscale) {
    rgba = convertToGrayscale(rgba);
  }

  // quality: 0.1-1.0 → 0-100
  const q = Math.max(0, Math.min(100, Math.round(options.quality <= 1 ? options.quality * 100 : options.quality)));

  // AVIF encode
  const imageData = {
    data: rgba as Uint8Array,
    width,
    height
  } as any;
  const encoded = await avifEncode(imageData, { quality: q, speed: 6 });
  const bytes = encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);
  return new Blob([bytes], { type: "image/avif" });
}
