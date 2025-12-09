export enum ConverterType {
  WASM_WEBP = "wasm-webp",
  // Future converters can be added here
  // WASM_AVIF = "wasm-avif",
  // SHARP_WEBP = "sharp-webp",
}

export interface PresetSettings {
  name: string;
  converterType: ConverterType;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  enableResize: boolean;
  enableGrayscale: boolean;
  attachmentFolder: string;
}

export const CONVERTER_OPTIONS = [
  { value: ConverterType.WASM_WEBP, label: "WASM WebP", description: "WebP conversion using WebAssembly" },
  // Future options:
  // { value: ConverterType.WASM_AVIF, label: "WASM AVIF", description: "AVIF conversion using WebAssembly" },
];

export interface ConverterSettings {
  converterType: ConverterType; // 現在選択されているコンバーター
  quality: number;          // 0.1 - 1.0
  maxWidth: number;
  maxHeight: number;
  enableResize: boolean;
  attachmentFolder: string; // 保存先
  autoReadClipboard: boolean; // 起動時クリップボード自動読み取り
  enableGrayscale: boolean; // グレースケール変換
  enableAutoConvert: boolean; // ドラッグ&ドロップ時の自動変換
  batchConvertExtensions: string[]; // バッチ変換対象の拡張子
  processAnimatedGifs: boolean; // アニメーションGIFを変換するかどうか（変換すると静止画になる）
  autoConvertPreset: string; // 自動変換時に使用するプリセット名
  enableAutoOrganizeImages: boolean; // 新規画像の自動整理
  presets: PresetSettings[]; // プリセット
}

export const DEFAULT_PRESET: PresetSettings = {
  name: "Default",
  converterType: ConverterType.WASM_WEBP,
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1080,
  enableResize: true,
  enableGrayscale: false,
  attachmentFolder: "Attachments",
};

export const DEFAULT_PRESETS: PresetSettings[] = [
  DEFAULT_PRESET,
];

export const DEFAULT_SETTINGS: ConverterSettings = {
  converterType: DEFAULT_PRESET.converterType,
  quality: DEFAULT_PRESET.quality,
  maxWidth: DEFAULT_PRESET.maxWidth,
  maxHeight: DEFAULT_PRESET.maxHeight,
  enableResize: DEFAULT_PRESET.enableResize,
  attachmentFolder: DEFAULT_PRESET.attachmentFolder,
  autoReadClipboard: false, // デフォルトはオフ（iPadでの問題回避）
  enableGrayscale: DEFAULT_PRESET.enableGrayscale,
  enableAutoConvert: false, // デフォルトはオフ（従来動作を維持）
  batchConvertExtensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'], // デフォルトは全対象
  processAnimatedGifs: false, // デフォルトは変換しない（アニメーション保持）
  autoConvertPreset: "Default", // デフォルトプリセットを使用
  enableAutoOrganizeImages: false, // デフォルトはオフ
  presets: [...DEFAULT_PRESETS], // デフォルトプリセット
};