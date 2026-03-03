import { ConverterType } from "../settings";
import { SizePredictor, SizePredictionResult, SizePredictionOptions } from "./size-predictor";

/**
 * Base class for Canvas API-based format predictors.
 * Shares image analysis logic with WebPSizePredictor but uses format-specific formulas.
 */
abstract class CanvasSizePredictor implements SizePredictor {
  abstract supportedType: ConverterType;
  abstract predict(originalFile: File, options: SizePredictionOptions): Promise<SizePredictionResult>;

  protected async analyzeImage(file: File): Promise<{
    width: number;
    height: number;
    complexity: number;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = Math.min(img.width, 200);
        canvas.height = Math.min(img.height, 200);

        if (!ctx) {
          resolve({ width: img.width, height: img.height, complexity: 0.5 });
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          let totalVariance = 0;
          let sampleCount = 0;

          for (let i = 40; i < data.length; i += 40) {
            const variance = Math.abs(data[i] - data[i - 40]) +
              Math.abs(data[i + 1] - data[i - 39]) +
              Math.abs(data[i + 2] - data[i - 38]);
            totalVariance += variance;
            sampleCount++;
          }

          const complexity = sampleCount > 0
            ? Math.min((totalVariance / sampleCount) / 255, 1)
            : 0.5;

          resolve({ width: img.width, height: img.height, complexity });
        } catch {
          resolve({ width: img.width, height: img.height, complexity: 0.5 });
        }

        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image for analysis'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  protected calculateEffectiveDimensions(
    originalWidth: number,
    originalHeight: number,
    options: SizePredictionOptions
  ): { width: number; height: number } {
    if (!options.enableResize) {
      return { width: originalWidth, height: originalHeight };
    }

    if (originalWidth <= options.maxWidth && originalHeight <= options.maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    const scaleByWidth = options.maxWidth / originalWidth;
    const scaleByHeight = options.maxHeight / originalHeight;
    const scale = Math.min(scaleByWidth, scaleByHeight);

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale)
    };
  }
}

/**
 * JPEG size predictor. JPEG is lossy, so size depends heavily on quality and image complexity.
 * Typically ~30% larger than WebP at the same visual quality.
 */
export class JPEGSizePredictor extends CanvasSizePredictor {
  supportedType = ConverterType.CANVAS_JPEG;

  async predict(originalFile: File, options: SizePredictionOptions): Promise<SizePredictionResult> {
    const imageData = await this.analyzeImage(originalFile);
    const dims = this.calculateEffectiveDimensions(imageData.width, imageData.height, options);

    const pixels = dims.width * dims.height;
    const channels = options.enableGrayscale ? 1 : 3;
    const resolution = Math.max(0.85, 1 - Math.log10(pixels / 1e6) * 0.05);
    const qualityFactor = Math.pow(options.quality, 0.7);
    const colorFactor = 0.5 + imageData.complexity * 1.0;

    // JPEG is ~30% larger than WebP at the same quality
    const predictedSize = Math.round(pixels * channels * 0.10 * resolution * qualityFactor * colorFactor);

    let confidence = 0.65;
    const fileType = originalFile.type.toLowerCase();
    if (fileType.includes('jpeg') || fileType.includes('jpg')) confidence += 0.1;
    else if (fileType.includes('png')) confidence += 0.05;

    const sizeMB = originalFile.size / (1024 * 1024);
    if (sizeMB < 0.1 || sizeMB > 50) confidence -= 0.2;
    if (options.quality < 0.3 || options.quality > 0.95) confidence -= 0.1;

    return {
      predictedSize: Math.max(predictedSize, 1024),
      confidence: Math.max(0.3, Math.min(0.85, confidence)),
      method: 'jpeg-heuristic'
    };
  }
}

/**
 * AVIF size predictor. AVIF is lossy (by default), ~20% more efficient than WebP.
 */
export class AVIFSizePredictor extends CanvasSizePredictor {
  supportedType = ConverterType.WASM_AVIF;

  async predict(originalFile: File, options: SizePredictionOptions): Promise<SizePredictionResult> {
    const imageData = await this.analyzeImage(originalFile);
    const dims = this.calculateEffectiveDimensions(imageData.width, imageData.height, options);

    const pixels = dims.width * dims.height;
    const channels = options.enableGrayscale ? 1 : 3;
    const resolution = Math.max(0.85, 1 - Math.log10(pixels / 1e6) * 0.05);
    const qualityFactor = Math.pow(options.quality, 0.8);
    const colorFactor = 0.5 + imageData.complexity * 1.0;

    // AVIF is ~20% smaller than WebP at the same quality
    const predictedSize = Math.round(pixels * channels * 0.065 * resolution * qualityFactor * colorFactor);

    let confidence = 0.55;
    const fileType = originalFile.type.toLowerCase();
    if (fileType.includes('jpeg') || fileType.includes('jpg')) confidence += 0.1;
    else if (fileType.includes('png')) confidence += 0.05;

    const sizeMB = originalFile.size / (1024 * 1024);
    if (sizeMB < 0.1 || sizeMB > 50) confidence -= 0.2;
    if (options.quality < 0.3 || options.quality > 0.95) confidence -= 0.1;

    return {
      predictedSize: Math.max(predictedSize, 1024),
      confidence: Math.max(0.25, Math.min(0.75, confidence)),
      method: 'avif-heuristic'
    };
  }
}

/**
 * PNG size predictor. PNG is lossless, so quality setting has no effect.
 * Size depends mainly on image dimensions, color depth, and how compressible the data is.
 */
export class PNGSizePredictor extends CanvasSizePredictor {
  supportedType = ConverterType.CANVAS_PNG;

  async predict(originalFile: File, options: SizePredictionOptions): Promise<SizePredictionResult> {
    const imageData = await this.analyzeImage(originalFile);
    const dims = this.calculateEffectiveDimensions(imageData.width, imageData.height, options);

    const pixels = dims.width * dims.height;
    const channels = options.enableGrayscale ? 2 : 4; // PNG stores with alpha
    // PNG compression ratio varies widely: simple images compress well, complex ones don't
    const compressionFactor = 0.3 + imageData.complexity * 0.7; // 0.3 for simple, 1.0 for complex

    const predictedSize = Math.round(pixels * channels * compressionFactor);

    // PNG predictions are less reliable than lossy formats
    let confidence = 0.5;
    const fileType = originalFile.type.toLowerCase();
    if (fileType.includes('png')) confidence += 0.1;

    const sizeMB = originalFile.size / (1024 * 1024);
    if (sizeMB < 0.1 || sizeMB > 50) confidence -= 0.15;

    return {
      predictedSize: Math.max(predictedSize, 1024),
      confidence: Math.max(0.25, Math.min(0.7, confidence)),
      method: 'png-heuristic'
    };
  }
}
