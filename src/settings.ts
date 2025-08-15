export interface ConverterSettings {
  quality: number;          // 0.1 - 1.0
  maxWidth: number;
  maxHeight: number;
  enableResize: boolean;
  attachmentFolder: string; // 保存先
  autoReadClipboard: boolean; // 起動時クリップボード自動読み取り
}

export const DEFAULT_SETTINGS: ConverterSettings = {
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1080,
  enableResize: true,
  attachmentFolder: "Attachments",
  autoReadClipboard: false, // デフォルトはオフ（iPadでの問題回避）
};