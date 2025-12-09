import { Notice, Plugin, Editor, Platform, MarkdownView, TFile, Modal } from "obsidian";
import { ConverterSettings, DEFAULT_SETTINGS } from "./settings";
import { openImageConverterModal } from "./ui/image-converter-modal";
import { WasmImageConverterSettingTab } from "./settings-tab";
import { sizePredictionService } from "./prediction/size-predictor";
import { WebPSizePredictor } from "./prediction/webp-predictor";
import { saveImageAndInsert, saveOriginalFile } from "./file-service";
import { isAnimatedGif } from "./utils/gif-check";

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
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const editor = view?.editor;
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

    // Batch convert command
    this.addCommand({
      id: "batch-convert-images",
      name: "Batch Convert Images to WebP",
      callback: async () => {
        await this.runBatchConvert();
      }
    });

    // File menu event
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile)) return;

        const supportedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'];
        if (supportedExtensions.includes(file.extension.toLowerCase())) {
          menu.addItem((item) => {
            item
              .setTitle("Convert to ...")
              .setIcon("image-file")
              .onClick(async () => {
                try {
                  const arrayBuffer = await this.app.vault.readBinary(file);
                  // Create a File object from the TFile content
                  const imageFile = new File([arrayBuffer], file.name, {
                    type: 'image/' + (file.extension === 'jpg' ? 'jpeg' : file.extension)
                  });

                  const link = await openImageConverterModal(this.app, this.settings, imageFile);

                  if (link) {
                    new Notice("✅ Image converted successfully");
                    // Copy link to clipboard since we might not have an active editor
                    await navigator.clipboard.writeText(link);
                    new Notice("📋 Link copied to clipboard");
                  }
                } catch (e) {
                  console.error("Conversion failed:", e);
                  new Notice("❌ Failed to load image for conversion");
                }
              });
          });
        }
      })
    );
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

  // ===== Batch Convert =====

  private async runBatchConvert() {
    try {
      // Find all target images
      const allFiles = this.app.vault.getFiles();
      const targetImages = allFiles.filter(file => this.isBatchConvertTarget(file));

      if (targetImages.length === 0) {
        new Notice('No images found for conversion');
        return;
      }

      // Count by extension
      const counts: Record<string, number> = {};
      targetImages.forEach(file => {
        const ext = file.extension.toLowerCase();
        counts[ext] = (counts[ext] || 0) + 1;
      });

      // Create confirmation message
      const countLines = Object.entries(counts)
        .map(([ext, count]) => `  - ${count} × ${ext}`)
        .join('\n');

      const confirmed = await this.showBatchConvertConfirmation(
        `Found ${targetImages.length} images to convert:\n${countLines}\n\nContinue?`
      );

      if (!confirmed) {
        return;
      }

      // Process images
      let totalOriginalSize = 0;
      let totalConvertedSize = 0;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < targetImages.length; i++) {
        const image = targetImages[i];

        // Check Animated GIFs
        if (image.extension.toLowerCase() === 'gif') {
          const arrayBuffer = await this.app.vault.readBinary(image);
          const blob = new Blob([arrayBuffer]);
          if (await isAnimatedGif(blob)) {
            if (!this.settings.processAnimatedGifs) {
              new Notice(`Skipping animated GIF: ${image.name}`);
              continue;
            }
            // If allowed, it will be converted (flattened to static)
          }
        }

        new Notice(`Converting ${i + 1}/${targetImages.length}: ${image.name}`);

        try {
          const result = await this.convertImage(image);
          totalOriginalSize += result.originalSize;
          totalConvertedSize += result.convertedSize;
          successCount++;
        } catch (error) {
          console.error(`Failed to convert ${image.name}:`, error);
          errorCount++;
        }
      }

      // Show completion notice
      const savedMB = ((totalOriginalSize - totalConvertedSize) / (1024 * 1024)).toFixed(2);
      const ratio = totalOriginalSize > 0
        ? (((totalOriginalSize - totalConvertedSize) / totalOriginalSize) * 100).toFixed(1)
        : '0';

      new Notice(
        `✅ Batch conversion complete!\n` +
        `Converted: ${successCount} images\n` +
        `Failed: ${errorCount} images\n` +
        `Total saved: ${savedMB} MB (${ratio}% reduction)`
      );
    } catch (error) {
      console.error('Batch convert failed:', error);
      new Notice('❌ Batch conversion failed');
    }
  }

  private showBatchConvertConfirmation(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new (class extends Modal {
        constructor(app: any) {
          super(app);
        }

        onOpen() {
          const { contentEl } = this;
          contentEl.empty();

          contentEl.createEl('h3', { text: 'Batch Convert Images' });
          contentEl.createEl('pre', { text: message });

          const buttonContainer = contentEl.createDiv('modal-button-container');

          const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
          cancelButton.onclick = () => {
            this.close();
            resolve(false);
          };

          const confirmButton = buttonContainer.createEl('button', {
            text: 'Convert',
            cls: 'mod-cta'
          });
          confirmButton.onclick = () => {
            this.close();
            resolve(true);
          };
        }

        onClose() {
          const { contentEl } = this;
          contentEl.empty();
        }
      })(this.app);

      modal.open();
    });
  }

  private isBatchConvertTarget(file: TFile): boolean {
    return this.settings.batchConvertExtensions.includes(file.extension.toLowerCase());
  }

  private async convertImage(imageFile: TFile): Promise<{ originalSize: number, convertedSize: number }> {
    // Get the selected preset
    const selectedPreset = this.settings.presets.find(
      p => p.name === this.settings.autoConvertPreset
    ) || this.settings.presets.find(p => p.name === "Default")
      || this.settings.presets[0];

    if (!selectedPreset) {
      throw new Error('No preset found');
    }

    // Import conversion functions
    const { convertImageToWebP } = await import('./converters/webp-converter');
    const { createProcessingOptions } = await import('./file-service');

    // Read the original file
    const originalSize = imageFile.stat.size;
    const arrayBuffer = await this.app.vault.readBinary(imageFile);
    const blob = new Blob([arrayBuffer], { type: `image/${imageFile.extension}` });
    const file = new File([blob], imageFile.name, { type: blob.type });

    // Convert to WebP
    const processingOptions = createProcessingOptions(this.settings, {
      quality: selectedPreset.quality,
      enableResize: selectedPreset.enableResize,
      maxWidth: selectedPreset.maxWidth,
      maxHeight: selectedPreset.maxHeight,
      enableGrayscale: selectedPreset.enableGrayscale
    });

    const convertedBlob = await convertImageToWebP(file, processingOptions);
    const convertedSize = convertedBlob.size;

    // Overwrite original file with WebP data
    const convertedArrayBuffer = await convertedBlob.arrayBuffer();
    await this.app.vault.modifyBinary(imageFile, convertedArrayBuffer);

    // Generate new path in attachment folder
    const folder = selectedPreset.attachmentFolder;
    const timestamp = (window as any).moment().format("YYYYMMDD[T]HHmmss");
    const sizeKB = (convertedSize / 1024).toFixed(2);
    const fileName = `IMG-${timestamp}-${sizeKB}.webp`;
    const destPath = `${folder}/${fileName}`;

    // Create folder if it doesn't exist
    if (!(await this.app.vault.adapter.exists(folder))) {
      await this.app.vault.adapter.mkdir(folder);
    }

    // Rename the file to new location
    // This triggers Obsidian's automatic link update
    await this.app.fileManager.renameFile(imageFile, destPath);

    return {
      originalSize,
      convertedSize
    };
  }

  // ===== Auto-Convert Events =====

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
        const pos = (editor as any).posAtMouse(evt);
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
            this.settings.batchConvertExtensions.some(ext =>
              data.name.toLowerCase().endsWith(`.${ext}`)
            );
        });

        if (hasSupportedFiles) {
          evt.preventDefault(); // Prevent default behavior
          await this.handleAutoConvert(fileData, editor, pos);
        }
      })
    );

    // Register paste event handler
    this.registerEvent(
      this.app.workspace.on("editor-paste", async (evt: ClipboardEvent, editor: Editor) => {
        if (!evt.clipboardData) {
          console.warn("ClipboardData object is null. Cannot process paste event.");
          return;
        }

        const cursor = editor.getCursor();

        // Extract clipboard item information
        const itemData: { kind: string, type: string, file: File | null }[] = [];
        for (let i = 0; i < evt.clipboardData.items.length; i++) {
          const item = evt.clipboardData.items[i];
          const file = item.kind === "file" ? item.getAsFile() : null;
          itemData.push({ kind: item.kind, type: item.type, file });
        }

        // Check if we should process these items
        const hasSupportedItems = itemData.some(data =>
          data.kind === "file" &&
          data.file &&
          data.type.startsWith('image/') &&
          this.settings.batchConvertExtensions.some(ext =>
            data.file!.name.toLowerCase().endsWith(`.${ext}`)
          )
        );

        if (hasSupportedItems) {
          evt.preventDefault();
          await this.handleAutoPaste(itemData, editor, cursor);
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
          this.settings.batchConvertExtensions.some(ext =>
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

        // Skip animated GIF
        if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
          if (await isAnimatedGif(file)) {
            if (!this.settings.processAnimatedGifs) {
              new Notice(`⚠️ Skipped animated GIF conversion: ${file.name}`);
              try {
                const savedPath = await saveOriginalFile(this.app, file, settings.attachmentFolder);
                const fileName = savedPath.split("/").pop()!;
                const markdownLink = `![[${fileName}]]`;
                editor.replaceRange(markdownLink, pos);
              } catch (err) {
                console.error("Failed to save original GIF:", err);
                new Notice(`❌ Failed to save original GIF: ${file.name}`);
              }
              continue;
            }
          }
        }

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

  private async handleAutoPaste(
    itemData: { kind: string; type: string; file: File | null }[],
    editor: Editor,
    cursor: any
  ) {
    // Filter supported image files
    const supportedFiles = itemData
      .filter(data =>
        data.kind === "file" &&
        data.file &&
        data.type.startsWith('image/') &&
        this.settings.batchConvertExtensions.some(ext =>
          data.file!.name.toLowerCase().endsWith(`.${ext}`)
        )
      )
      .map(data => data.file!)
      .filter((file): file is File => file !== null);

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

        // Skip animated GIF
        if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
          if (await isAnimatedGif(file)) {
            if (!this.settings.processAnimatedGifs) {
              new Notice(`⚠️ Skipped animated GIF conversion: ${file.name}`);
              try {
                const savedPath = await saveOriginalFile(this.app, file, settings.attachmentFolder);
                const fileName = savedPath.split("/").pop()!;
                const markdownLink = `![[${fileName}]]`;
                editor.replaceRange(markdownLink, cursor);
              } catch (err) {
                console.error("Failed to save original GIF:", err);
                new Notice(`❌ Failed to save original GIF: ${file.name}`);
              }
              continue;
            }
          }
        }

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

        // Insert link at cursor position
        editor.replaceRange(markdownLink, cursor);

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

  // ===== Auto-Organize Images =====

  setupAutoOrganizeImages() {
    if (!this.settings.enableAutoOrganizeImages) {
      console.log('[Auto-Organize] Disabled in settings');
      return;
    }

    console.log('[Auto-Organize] Setting up image file watcher...');

    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        // Only process TFile objects
        if (!(file instanceof TFile)) {
          return;
        }

        // Check if this is a supported image file
        if (!this.isSupportedImageFile(file)) {
          return;
        }

        console.log('[Auto-Organize] New image detected:', file.path);

        // Wait a bit to ensure the file is fully written
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
          await this.organizeImage(file);
        } catch (error) {
          console.error('[Auto-Organize] Failed to organize image:', error);
          new Notice(`❌ Failed to organize ${file.name}`);
        }
      })
    );

    console.log('[Auto-Organize] Image file watcher registered');
  }

  private isSupportedImageFile(file: TFile): boolean {
    return this.settings.batchConvertExtensions.includes(file.extension.toLowerCase());
  }

  private async organizeImage(imageFile: TFile): Promise<void> {
    console.log('[Auto-Organize] Starting organization for:', imageFile.name);

    try {
      // Check for animated GIF
      if (imageFile.extension.toLowerCase() === 'gif') {
        const arrayBuffer = await this.app.vault.readBinary(imageFile);
        const blob = new Blob([arrayBuffer]);
        if (await isAnimatedGif(blob)) {
          if (!this.settings.processAnimatedGifs) {
            console.log('[Auto-Organize] Skipped animated GIF:', imageFile.name);
            return;
          }
        }
      }

      // Get the selected preset
      const selectedPreset = this.settings.presets.find(
        p => p.name === this.settings.autoConvertPreset
      ) || this.settings.presets.find(p => p.name === "Default")
        || this.settings.presets[0];

      if (!selectedPreset) {
        console.warn('[Auto-Organize] No preset found');
        return;
      }

      // Read the original file
      const arrayBuffer = await this.app.vault.readBinary(imageFile);
      const blob = new Blob([arrayBuffer], { type: `image/${imageFile.extension}` });
      const file = new File([blob], imageFile.name, { type: blob.type });

      // Convert to WebP
      const settings = {
        ...this.settings,
        attachmentFolder: selectedPreset.attachmentFolder
      };

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

      console.log('[Auto-Organize] Conversion successful:', result.path);

      // Get the converted file
      const convertedFile = this.app.vault.getAbstractFileByPath(result.path);
      if (!(convertedFile instanceof TFile)) {
        throw new Error('Converted file not found');
      }

      // Rename the original file to match the converted file location
      // This will trigger Obsidian's automatic link update
      await this.app.fileManager.renameFile(convertedFile, imageFile.path);

      console.log('[Auto-Organize] Replaced original file with converted file');

      // Show success notification
      const originalKB = (result.originalSize / 1024).toFixed(2);
      const convertedKB = (result.convertedSize / 1024).toFixed(2);
      const ratio = (((result.originalSize - result.convertedSize) / result.originalSize) * 100).toFixed(1);

      new Notice(
        `✅ Auto-organized: ${imageFile.name} → ${originalKB}KB → ${convertedKB}KB (${ratio}% compressed)`
      );
    } catch (error) {
      console.error('[Auto-Organize] Failed to organize image:', error);
      throw error;
    }
  }

}