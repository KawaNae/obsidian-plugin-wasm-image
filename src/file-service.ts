import { App } from "obsidian";
import { ConverterSettings, ConverterType } from "./settings";
import { convertImageToWebP, ImageProcessingOptions } from "./converters/webp-converter";

export interface ConversionResult {
  path: string;
  originalSize: number;
  convertedSize: number;
}

export function createProcessingOptions(
  settings: ConverterSettings,
  overrides?: Partial<ImageProcessingOptions>
): ImageProcessingOptions {
  return {
    quality: settings.quality,
    enableResize: settings.enableResize,
    maxWidth: settings.maxWidth,
    maxHeight: settings.maxHeight,
    enableGrayscale: settings.enableGrayscale,
    ...overrides
  };
}

export async function saveImageAndInsert(
  app: App,
  file: File,
  settings: ConverterSettings,
  quality: number,
  enableResize: boolean,
  maxWidth: number,
  maxHeight: number,
  enableGrayscale: boolean = false,
  converterType: ConverterType = ConverterType.WASM_WEBP
): Promise<ConversionResult> {
  const folder = settings.attachmentFolder;

  const processingOptions: ImageProcessingOptions = createProcessingOptions(settings, {
    quality,
    enableResize,
    maxWidth,
    maxHeight,
    enableGrayscale
  });

  // Convert image based on converter type
  let convertedBlob: Blob;
  let fileExtension: string;

  switch (converterType) {
    case ConverterType.WASM_WEBP:
    default:
      convertedBlob = await convertImageToWebP(file, processingOptions);
      fileExtension = "webp";
      break;
    // Future converters can be added here:
    // case ConverterType.WASM_AVIF:
    //   convertedBlob = await convertImageToAVIF(file, processingOptions);
    //   fileExtension = "avif";
    //   break;
  }

  const fileName = generateFileName(fileExtension, convertedBlob.size);
  const destPath = `${folder}/${fileName}`;

  // フォルダ無ければ作成
  if (!(await app.vault.adapter.exists(folder))) {
    await app.vault.adapter.mkdir(folder);
  }
  const ab = await convertedBlob.arrayBuffer();
  await app.vault.adapter.writeBinary(destPath, ab);

  return { path: destPath, originalSize: file.size, convertedSize: convertedBlob.size };
}

/**
 * Generates a consistent file name based on timestamp and size.
 * Centralized for future customization (e.g. regex support).
 */
export function generateFileName(extension: string, sizeBytes: number): string {
  const timestamp = (window as any).moment().format("YYYYMMDD[T]HHmmss");
  const sizeKB = (sizeBytes / 1024).toFixed(2);
  return `IMG-${timestamp}-${sizeKB}.${extension}`;
}

/**
 * Saves the original file without conversion, but follows the plugin's naming and folder conventions.
 */
export async function saveOriginalFile(app: App, file: File, folder: string): Promise<string> {
  const extension = file.name.split('.').pop() || 'unknown';
  const fileName = generateFileName(extension, file.size);
  const destPath = `${folder}/${fileName}`;

  // Create folder if it doesn't exist
  if (!(await app.vault.adapter.exists(folder))) {
    await app.vault.adapter.mkdir(folder);
  }

  const arrayBuffer = await file.arrayBuffer();
  await app.vault.adapter.writeBinary(destPath, arrayBuffer);

  return destPath;
}