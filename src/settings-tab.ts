import { App, PluginSettingTab, Setting } from "obsidian";
import WasmImageConverterPlugin from "./main";

export class WasmImageConverterSettingTab extends PluginSettingTab {
  plugin: WasmImageConverterPlugin;

  constructor(app: App, plugin: WasmImageConverterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "WASM Image Converter Settings" });

    new Setting(containerEl)
      .setName("Quality")
      .setDesc("WebP compression quality (0.1 - 1.0). Higher values mean better quality but larger files.")
      .addText(text => text
        .setPlaceholder("0.8")
        .setValue(String(this.plugin.settings.quality))
        .onChange(async (value) => {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && numValue >= 0.1 && numValue <= 1.0) {
            this.plugin.settings.quality = numValue;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName("Enable resize")
      .setDesc("Automatically resize images that exceed the maximum dimensions")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableResize)
        .onChange(async (value) => {
          this.plugin.settings.enableResize = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Maximum width")
      .setDesc("Maximum width in pixels for resized images")
      .addText(text => text
        .setPlaceholder("1920")
        .setValue(String(this.plugin.settings.maxWidth))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            this.plugin.settings.maxWidth = numValue;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName("Maximum height")
      .setDesc("Maximum height in pixels for resized images")
      .addText(text => text
        .setPlaceholder("1080")
        .setValue(String(this.plugin.settings.maxHeight))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            this.plugin.settings.maxHeight = numValue;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName("Attachment folder")
      .setDesc("Folder where converted WebP images will be saved")
      .addText(text => text
        .setPlaceholder("Attachments")
        .setValue(this.plugin.settings.attachmentFolder)
        .onChange(async (value) => {
          this.plugin.settings.attachmentFolder = value || "Attachments";
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Auto-read clipboard on startup")
      .setDesc("Automatically check clipboard for images when opening the converter (may show permission dialog on mobile devices)")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoReadClipboard)
        .onChange(async (value) => {
          this.plugin.settings.autoReadClipboard = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Convert to grayscale")
      .setDesc("Convert images to grayscale before WebP conversion for better compression of documents and diagrams")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableGrayscale)
        .onChange(async (value) => {
          this.plugin.settings.enableGrayscale = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("h3", { text: "Preview" });
    
    const previewEl = containerEl.createEl("div", { 
      cls: "setting-item-description",
      text: `Current settings: Quality ${(this.plugin.settings.quality * 100).toFixed(0)}%, ` +
            `${this.plugin.settings.enableResize ? `Max size ${this.plugin.settings.maxWidth}x${this.plugin.settings.maxHeight}` : "No resize"}, ` +
            `${this.plugin.settings.enableGrayscale ? "Grayscale enabled" : "Color"}, ` +
            `Save to "${this.plugin.settings.attachmentFolder}/"`
    });
  }
}