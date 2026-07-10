import { ConverterType } from "../settings";
import { SizePredictionOptions, SizePredictionResult } from "./size-predictor";
import { convertImageToWebP, ImageProcessingOptions } from "../converters/webp-converter";
import { convertImageWithCanvas } from "../converters/canvas-converter";
import { convertImageToAVIF } from "../converters/avif-converter";

// Pixel exponent of the power-law extrapolation, per format
// (docs/size-prediction-experiment-2026-07-10.md)
const ALPHA: Record<string, number> = {
  [ConverterType.WASM_WEBP]: 0.75,
  [ConverterType.CANVAS_JPEG]: 0.8,
  [ConverterType.CANVAS_PNG]: 0.75,
  [ConverterType.WASM_AVIF]: 0.65,
};

/**
 * AVIF encoding is much slower than the others; a smaller sample keeps the
 * dialog responsive even on weak hardware (~0.7s at 6x CPU throttling).
 */
function sampleEdge(type: ConverterType): number {
  return type === ConverterType.WASM_AVIF ? 200 : 400;
}

async function encode(type: ConverterType, file: File, opts: ImageProcessingOptions): Promise<Blob> {
  switch (type) {
    case ConverterType.CANVAS_PNG: return convertImageWithCanvas(file, "image/png", opts);
    case ConverterType.CANVAS_JPEG: return convertImageWithCanvas(file, "image/jpeg", opts);
    case ConverterType.WASM_AVIF: return convertImageToAVIF(file, opts);
    case ConverterType.WASM_WEBP:
    default: return convertImageToWebP(file, opts);
  }
}

/**
 * Predicts the converted size by actually encoding a downscaled sample and
 * extrapolating along bytes ∝ pixels^α. Quality/grayscale effects are exact
 * (the sample uses the real settings); only the pixel scaling is modeled.
 */
export async function predictBySampleEncode(
  file: File,
  options: SizePredictionOptions
): Promise<SizePredictionResult | null> {
  try {
    const bmp = await createImageBitmap(file);
    const width = bmp.width, height = bmp.height;
    bmp.close();

    // Dimensions the real conversion would produce
    const targetScale = options.enableResize
      ? Math.min(1, options.maxWidth / width, options.maxHeight / height)
      : 1;
    const targetPx = Math.max(1, Math.round(width * targetScale))
      * Math.max(1, Math.round(height * targetScale));

    const edge = sampleEdge(options.converterType);
    const sampleScale = Math.min(1, edge / width, edge / height);
    const samplePx = Math.max(1, Math.round(width * sampleScale))
      * Math.max(1, Math.round(height * sampleScale));

    const base = { quality: options.quality, enableGrayscale: options.enableGrayscale };

    if (targetPx <= samplePx) {
      // Output is no bigger than the sample: encode at the real output size
      const blob = await encode(options.converterType, file, {
        ...base,
        enableResize: options.enableResize,
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
      });
      return { predictedSize: blob.size, confidence: 1, method: "sample-encode-exact" };
    }

    const blob = await encode(options.converterType, file, {
      ...base,
      enableResize: true,
      maxWidth: edge,
      maxHeight: edge,
    });
    const alpha = ALPHA[options.converterType] ?? 0.75;
    const predictedSize = Math.round(blob.size * Math.pow(targetPx / samplePx, alpha));
    return { predictedSize, confidence: 0.9, method: "sample-encode" };
  } catch (e) {
    console.warn("Sampled size prediction failed:", e);
    return null;
  }
}
