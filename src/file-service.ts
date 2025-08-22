import { App } from "obsidian";
import { ConverterSettings } from "./settings";
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
  enableGrayscale: boolean = false
): Promise<ConversionResult> {
  const folder = settings.attachmentFolder;
  const timestamp = (window as any).moment().format("YYYYMMDD[T]HHmmss");

  const processingOptions: ImageProcessingOptions = createProcessingOptions(settings, {
    quality,
    enableResize,
    maxWidth,
    maxHeight,
    enableGrayscale
  });
  
  const webpBlob = await convertImageToWebP(file, processingOptions);
  const webpSizeKB = (webpBlob.size / 1024).toFixed(2);
  const fileName = `IMG-${timestamp}-${webpSizeKB}.webp`;
  const destPath = `${folder}/${fileName}`;

  // フォルダ無ければ作成
  if (!(await app.vault.adapter.exists(folder))) {
    await app.vault.adapter.mkdir(folder);
  }
  const ab = await webpBlob.arrayBuffer();
  await app.vault.adapter.writeBinary(destPath, ab);

  return { path: destPath, originalSize: file.size, convertedSize: webpBlob.size };
}