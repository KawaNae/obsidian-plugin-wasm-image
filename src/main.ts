import { Notice, Plugin } from "obsidian";
import { ConverterSettings, DEFAULT_SETTINGS } from "./settings";
import { openImageConverterModal } from "./image-converter-modal";

export default class WasmImageConverterPlugin extends Plugin {
  settings: ConverterSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    // 設定ロード（必要なら settings タブは後で追加可）
    const saved = await this.loadData();
    if (saved) this.settings = { ...DEFAULT_SETTINGS, ...saved };

    this.addCommand({
      id: "wasm-webp-open-converter",
      name: "WASM: Image → WebP Converter",
      callback: async () => {
        try {
          const link = await openImageConverterModal(this.app, this.settings);
          if (!link) return;

          const active = this.app.workspace.getActiveFile();
          if (active) {
            const editor = this.app.workspace.activeLeaf?.view?.editor;
            if (editor) {
              const cursor = editor.getCursor();
              editor.replaceRange(link, cursor);
            } else {
              const content = await this.app.vault.read(active);
              await this.app.vault.modify(active, content + "\n" + link);
            }
          } else {
            new Notice("📋 WebP link: " + link);
          }
        } catch (e) {
          console.error(e);
          new Notice("❌ Image conversion failed");
        }
      },
    });
  }

  async onunload() {
    // 何もしない
  }
}

