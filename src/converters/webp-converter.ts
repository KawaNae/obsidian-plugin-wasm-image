import webpEncode from "@jsquash/webp/encode";
import { convertToGrayscale } from "./grayscale";

export interface ImageProcessingOptions {
  quality: number; // 0.1 - 1.0
  enableResize: boolean;
  maxWidth: number;
  maxHeight: number;
  enableGrayscale: boolean;
}

// オーバーロード: 新しいインターフェース
export async function convertImageToWebP(
  file: Blob,
  options: ImageProcessingOptions
): Promise<Blob>;

// オーバーロード: 既存の互換性
export async function convertImageToWebP(
  file: Blob,
  quality01: number,
  enableResize: boolean,
  maxWidth: number,
  maxHeight: number,
  enableGrayscale?: boolean
): Promise<Blob>;

export async function convertImageToWebP(
  file: Blob,
  optionsOrQuality: ImageProcessingOptions | number,
  enableResize?: boolean,
  maxWidth?: number,
  maxHeight?: number,
  enableGrayscale: boolean = false
): Promise<Blob> {
  // 引数の判定と正規化
  const options: ImageProcessingOptions = typeof optionsOrQuality === 'object' 
    ? optionsOrQuality 
    : {
        quality: optionsOrQuality,
        enableResize: enableResize!,
        maxWidth: maxWidth!,
        maxHeight: maxHeight!,
        enableGrayscale: enableGrayscale
      };

  // 画像ロード（createImageBitmap → <img> フォールバック）
  const bmp = await (async () => {
    try {
      // @ts-ignore (Electron/Obsidian 環境で存在する場合あり)
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

  // リサイズ
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
  ctx.drawImage(bmp, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  let rgba = data instanceof Uint8ClampedArray ? new Uint8Array(data.buffer) : (data as Uint8Array);

  // グレースケール変換
  if (options.enableGrayscale) {
    rgba = convertToGrayscale(rgba);
  }

  // jSquash の quality は 0-100
  const q = Math.max(0, Math.min(100, Math.round(options.quality <= 1 ? options.quality * 100 : options.quality)));

  // WASM エンコード（build.mjs により wasm は data:URL 埋め込み済み）
  const encoded = await webpEncode({ data: rgba, width, height }, { quality: q });
  const bytes = encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);
  return new Blob([bytes], { type: "image/webp" });
}