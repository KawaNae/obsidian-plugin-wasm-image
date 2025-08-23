import { ConverterType } from "../settings";

export interface SizePredictionResult {
  predictedSize: number; // bytes
  confidence: number; // 0-1, prediction confidence level
  method: string; // prediction method used
}

export interface SizePredictionOptions {
  converterType: ConverterType;
  quality: number;
  enableGrayscale: boolean;
  enableResize: boolean;
  maxWidth: number;
  maxHeight: number;
}

export interface SizePredictor {
  predict(
    originalFile: File, 
    options: SizePredictionOptions
  ): Promise<SizePredictionResult>;
  
  supportedType: ConverterType;
}

export class SizePredictionService {
  private predictors: Map<ConverterType, SizePredictor> = new Map();

  registerPredictor(predictor: SizePredictor) {
    this.predictors.set(predictor.supportedType, predictor);
  }

  async predictSize(
    originalFile: File,
    options: SizePredictionOptions
  ): Promise<SizePredictionResult | null> {
    const predictor = this.predictors.get(options.converterType);
    if (!predictor) {
      return null;
    }

    try {
      return await predictor.predict(originalFile, options);
    } catch (error) {
      console.warn('Size prediction failed:', error);
      return null;
    }
  }

  getSupportedTypes(): ConverterType[] {
    return Array.from(this.predictors.keys());
  }
}

// Global service instance
export const sizePredictionService = new SizePredictionService();