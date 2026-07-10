import { App, normalizePath, TFile, TFolder } from "obsidian";
import { ConverterSettings, ConverterType, getExtensionForConverter } from "./settings";
import { convertImageToWebP, ImageProcessingOptions } from "./converters/webp-converter";
import { convertImageWithCanvas } from "./converters/canvas-converter";
import { convertImageToAVIF } from "./converters/avif-converter";

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

/**
 * Ensures a folder exists using the Vault API so Obsidian's file index
 * knows about it immediately (adapter.mkdir bypasses the index).
 */
async function ensureFolder(app: App, folder: string): Promise<void> {
  if (app.vault.getAbstractFileByPath(folder) instanceof TFolder) return;
  try {
    await app.vault.createFolder(folder);
  } catch (e) {
    // Another writer may have created it concurrently
    if (!(app.vault.getAbstractFileByPath(folder) instanceof TFolder)) throw e;
  }
}

/**
 * Creates a binary file via the Vault API, deduplicating the name on the
 * (unlikely) chance the timestamp-based name already exists.
 */
async function createBinaryFile(app: App, destPath: string, data: ArrayBuffer): Promise<string> {
  let path = destPath;
  for (let i = 1; app.vault.getAbstractFileByPath(path) && i < 10; i++) {
    path = destPath.replace(/(\.[^.]+)$/, `-${i}$1`);
  }
  await app.vault.createBinary(path, data);
  return path;
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
  const folder = normalizePath(settings.attachmentFolder);

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
    case ConverterType.CANVAS_PNG:
      convertedBlob = await convertImageWithCanvas(file, "image/png", processingOptions);
      fileExtension = "png";
      break;
    case ConverterType.CANVAS_JPEG:
      convertedBlob = await convertImageWithCanvas(file, "image/jpeg", processingOptions);
      fileExtension = "jpg";
      break;
    case ConverterType.WASM_AVIF:
      convertedBlob = await convertImageToAVIF(file, processingOptions);
      fileExtension = "avif";
      break;
    case ConverterType.WASM_WEBP:
    default:
      convertedBlob = await convertImageToWebP(file, processingOptions);
      fileExtension = "webp";
      break;
  }

  const fileName = generateFileName(fileExtension, convertedBlob.size);
  const destPath = normalizePath(`${folder}/${fileName}`);

  await ensureFolder(app, folder);
  const ab = await convertedBlob.arrayBuffer();
  const savedPath = await createBinaryFile(app, destPath, ab);

  return { path: savedPath, originalSize: file.size, convertedSize: convertedBlob.size };
}

/**
 * Generates a consistent file name based on timestamp and size.
 * Centralized for future customization (e.g. regex support).
 */
export function generateFileName(extension: string, sizeBytes: number): string {
  const timestamp = (window as any).moment().format("YYYYMMDD[T]HHmmssSSS");
  const sizeKB = (sizeBytes / 1024).toFixed(2);
  return `IMG-${timestamp}-${sizeKB}.${extension}`;
}

/**
 * Saves the original file without conversion, but follows the plugin's naming and folder conventions.
 */
export async function saveOriginalFile(app: App, file: File, folder: string): Promise<string> {
  folder = normalizePath(folder);
  const m = file.name.match(/\.([^.]+)$/);
  const extension = m ? m[1] : 'unknown';
  const fileName = generateFileName(extension, file.size);
  const destPath = normalizePath(`${folder}/${fileName}`);

  await ensureFolder(app, folder);
  const arrayBuffer = await file.arrayBuffer();
  return await createBinaryFile(app, destPath, arrayBuffer);
}

/**
 * Converts the file and REPLACES the original TFile with the converted content.
 * Also renames the file to match the new extension and timestamp convention, updating links.
 */
export async function convertAndReplaceFile(
  app: App,
  targetFile: TFile,
  file: File, // Source content
  settings: ConverterSettings,
  quality: number,
  enableResize: boolean,
  maxWidth: number,
  maxHeight: number,
  enableGrayscale: boolean,
  converterType: ConverterType
): Promise<ConversionResult> {
  const folder = normalizePath(settings.attachmentFolder);

  const processingOptions: ImageProcessingOptions = createProcessingOptions(settings, {
    quality,
    enableResize,
    maxWidth,
    maxHeight,
    enableGrayscale
  });

  // Convert
  let convertedBlob: Blob;
  let fileExtension: string;

  switch (converterType) {
    case ConverterType.CANVAS_PNG:
      convertedBlob = await convertImageWithCanvas(file, "image/png", processingOptions);
      fileExtension = "png";
      break;
    case ConverterType.CANVAS_JPEG:
      convertedBlob = await convertImageWithCanvas(file, "image/jpeg", processingOptions);
      fileExtension = "jpg";
      break;
    case ConverterType.WASM_AVIF:
      convertedBlob = await convertImageToAVIF(file, processingOptions);
      fileExtension = "avif";
      break;
    case ConverterType.WASM_WEBP:
    default:
      convertedBlob = await convertImageToWebP(file, processingOptions);
      fileExtension = "webp";
      break;
  }

  // Overwrite and rename
  return replaceFileContentAndPath(app, targetFile, convertedBlob, folder, fileExtension);
}

/**
 * Replaces the content of a TFile with a Blob, and renames/moves it to a new location.
 * This handles the filesystem side of "converting" an existing file.
 */
export async function replaceFileContentAndPath(
  app: App,
  targetFile: TFile,
  newContent: Blob,
  folder: string,
  newExtension: string
): Promise<ConversionResult> {
  const originalSize = targetFile.stat.size;

  // Keep original bytes so a failure after the overwrite can be rolled back
  const originalData = await app.vault.readBinary(targetFile);

  // Generate new path and ensure the folder exists before touching the file
  folder = normalizePath(folder);
  const fileName = generateFileName(newExtension, newContent.size);
  const destPath = normalizePath(`${folder}/${fileName}`);
  await ensureFolder(app, folder);

  // Overwrite content
  const arrayBuffer = await newContent.arrayBuffer();
  await app.vault.modifyBinary(targetFile, arrayBuffer);

  // Rename/Move file (triggers link updates)
  try {
    await app.fileManager.renameFile(targetFile, destPath);
  } catch (renameError) {
    // Restore the original bytes so no corrupted file is left behind
    try {
      await app.vault.modifyBinary(targetFile, originalData);
    } catch (rollbackError) {
      console.error("Rollback after failed rename also failed:", rollbackError);
    }
    throw renameError;
  }

  return {
    path: destPath,
    originalSize: originalSize,
    convertedSize: newContent.size
  };
}