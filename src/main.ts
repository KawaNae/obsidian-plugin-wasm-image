import { Notice, Plugin, Editor, Platform } from "obsidian";
import { ConverterSettings, DEFAULT_SETTINGS } from "./settings";
import { openImageConverterModal } from "./image-converter-modal";
import { WasmImageConverterSettingTab } from "./settings-tab";
import { sizePredictionService } from "./prediction/size-predictor";
import { WebPSizePredictor } from "./prediction/webp-predictor";
import { saveImageAndInsert } from "./file-service";

export default class WasmImageConverterPlugin extends Plugin {
  settings: ConverterSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    await this.loadSettings();

    // Initialize size prediction service
    sizePredictionService.registerPredictor(new WebPSizePredictor());

    this.addSettingTab(new WasmImageConverterSettingTab(this.app, this));

    // Register auto-convert events if enabled
    this.registerAutoConvertEvents();

    this.addCommand({
      id: "wasm-webp-open-converter",
      name: "Convert Image",
      icon: "image-plus", // 他のオプション: "image", "convert", "camera", "file-image"
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

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private registerAutoConvertEvents() {
    // Auto-convert disabled or mobile platform
    if (!this.settings.enableAutoConvert || Platform.isMobile) return;

    this.registerEvent(
      this.app.workspace.on("editor-drop", async (evt: DragEvent, editor: Editor) => {
        if (!evt.dataTransfer) {
          console.warn("DataTransfer object is null. Cannot process drop event.");
          return;
        }

        // Get the actual drop position from the mouse event
        const pos = editor.posAtMouse(evt);
        if (!pos) {
          console.warn("Could not determine drop position");
          return;
        }

        // Extract file data
        const fileData: { name: string, type: string, file: File }[] = [];
        for (let i = 0; i < evt.dataTransfer.files.length; i++) {
          const file = evt.dataTransfer.files[i];
          fileData.push({ name: file.name, type: file.type, file });
        }

        // Check if we should process these files
        const hasSupportedFiles = fileData.some(data => {
          return data.type.startsWith('image/') && 
            ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].some(ext => 
              data.name.toLowerCase().endsWith(`.${ext}`)
            );
        });

        if (hasSupportedFiles) {
          evt.preventDefault(); // Prevent default behavior
          await this.handleAutoConvert(fileData, editor, pos);
        }
      })
    );
  }

  private async handleAutoConvert(
    fileData: { name: string; type: string; file: File }[], 
    editor: Editor, 
    pos: any
  ) {
    // Filter supported image files
    const supportedFiles = fileData
      .filter(data => {
        return data.type.startsWith('image/') && 
          ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].some(ext => 
            data.name.toLowerCase().endsWith(`.${ext}`)
          );
      })
      .map(data => data.file);

    if (supportedFiles.length === 0) return;

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file detected.');
      return;
    }

    // Get the selected preset for auto-conversion
    const selectedPreset = this.settings.presets.find(p => p.name === this.settings.autoConvertPreset) 
      || this.settings.presets.find(p => p.name === "Default") 
      || this.settings.presets[0];

    if (!selectedPreset) {
      new Notice('❌ No preset found for auto-conversion');
      return;
    }

    // Process each file sequentially
    for (const file of supportedFiles) {
      try {
        // Update the settings to use the preset's attachment folder
        const settings = { ...this.settings, attachmentFolder: selectedPreset.attachmentFolder };

        const result = await saveImageAndInsert(
          this.app,
          file,
          settings,
          selectedPreset.quality,
          selectedPreset.enableResize,
          selectedPreset.maxWidth,
          selectedPreset.maxHeight,
          selectedPreset.enableGrayscale,
          selectedPreset.converterType
        );

        const fileName = result.path.split("/").pop()!;
        const markdownLink = `![[${fileName}]]`;

        // Insert link at drop position
        editor.replaceRange(markdownLink, pos);

        // Show success notification with preset info
        const originalKB = (result.originalSize / 1024).toFixed(2);
        const convertedKB = (result.convertedSize / 1024).toFixed(2);
        const ratio = (((result.originalSize - result.convertedSize) / result.originalSize) * 100).toFixed(1);
        new Notice(`✅ Auto-converted (${selectedPreset.name}): ${file.name} → ${originalKB}KB → ${convertedKB}KB (${ratio}% compressed)`);

      } catch (error) {
        console.error("Auto-conversion failed:", error);
        new Notice(`❌ Auto-conversion failed for ${file.name}`);
      }
    }
  }
}

