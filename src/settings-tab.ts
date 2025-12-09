import { App, PluginSettingTab, Setting, Modal } from "obsidian";
import WasmImageConverterPlugin from "./main";
import { PresetSettings, DEFAULT_PRESETS, DEFAULT_PRESET, ConverterType, CONVERTER_OPTIONS } from "./settings";

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

    // ===== General Settings Section (Not saved in presets) =====
    containerEl.createEl("h3", { text: "General Settings" });

    const generalDesc = containerEl.createEl("div", {
      cls: "setting-item-description",
      text: "These settings apply globally and are not saved in presets."
    });
    generalDesc.style.marginBottom = "15px";

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
      .setName("Auto-convert on drag & drop")
      .setDesc("Automatically convert images when dragging and dropping them into the editor (desktop only)")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAutoConvert)
        .onChange(async (value) => {
          this.plugin.settings.enableAutoConvert = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Auto-convert preset")
      .setDesc("Which preset to use for automatic conversion on drag & drop")
      .addDropdown(dropdown => {
        // Populate dropdown with available presets
        this.plugin.settings.presets.forEach((preset) => {
          dropdown.addOption(preset.name, preset.name);
        });

        // Set current value, fallback to "Default" if preset doesn't exist
        const currentPreset = this.plugin.settings.autoConvertPreset;
        const presetExists = this.plugin.settings.presets.some(p => p.name === currentPreset);
        dropdown.setValue(presetExists ? currentPreset : "Default");

        dropdown.onChange(async (value) => {
          this.plugin.settings.autoConvertPreset = value;
          await this.plugin.saveSettings();
        });
      });


    containerEl.createEl("h4", { text: "Batch or Auto convert target extensions" });

    const targetExtDesc = containerEl.createDiv({
      cls: "setting-item-description",
      text: "Select which image extensions to convert (Applies to both Batch Convert and Auto-Convert)"
    });
    targetExtDesc.style.marginBottom = "10px";

    // Create checkboxes for each extension
    const extensionsContainer = containerEl.createDiv('batch-convert-extensions-container');
    const availableExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];

    availableExtensions.forEach(ext => {
      // Special handling for GIF to include nested "Animated GIF" setting
      if (ext === 'gif') {
        const isGifEnabled = this.plugin.settings.batchConvertExtensions.includes('gif');

        // Parent GIF setting
        new Setting(extensionsContainer)
          .setName('GIF')
          .addToggle(toggle => toggle
            .setValue(isGifEnabled)
            .onChange(async (value) => {
              if (value) {
                if (!this.plugin.settings.batchConvertExtensions.includes('gif')) {
                  this.plugin.settings.batchConvertExtensions.push('gif');
                }
              } else {
                this.plugin.settings.batchConvertExtensions =
                  this.plugin.settings.batchConvertExtensions.filter(e => e !== 'gif');
              }
              await this.plugin.saveSettings();
              // Refresh to update child element state
              this.display();
            }));

        // Nested Animated GIF setting
        const animatedGifSetting = new Setting(extensionsContainer)
          .setName("Animated GIF")
          .setDesc("If enabled, animated GIFs will be converted to WebP (static). If disabled, original GIF is kept.")
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.processAnimatedGifs)
            .setDisabled(!isGifEnabled) // Disable if parent is off
            .onChange(async (value) => {
              this.plugin.settings.processAnimatedGifs = value;
              await this.plugin.saveSettings();
            }));

        // Add indentation style
        animatedGifSetting.settingEl.style.marginLeft = "2em";
        animatedGifSetting.settingEl.style.borderTop = "none";
        if (!isGifEnabled) {
          animatedGifSetting.settingEl.style.opacity = "0.5";
        }

      } else {
        // Standard handling for other extensions
        new Setting(extensionsContainer)
          .setName(ext.toUpperCase())
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.batchConvertExtensions.includes(ext))
            .onChange(async (value) => {
              if (value) {
                if (!this.plugin.settings.batchConvertExtensions.includes(ext)) {
                  this.plugin.settings.batchConvertExtensions.push(ext);
                }
              } else {
                this.plugin.settings.batchConvertExtensions =
                  this.plugin.settings.batchConvertExtensions.filter(e => e !== ext);
              }
              await this.plugin.saveSettings();
            }));
      }
    });


    // ===== Presets Section =====
    containerEl.createEl("h3", { text: "Conversion Presets" });

    const presetsDesc = containerEl.createEl("div", {
      cls: "setting-item-description",
      text: "Manage conversion presets that include: Attachment folder, Quality, Grayscale, Resize settings, and Maximum dimensions."
    });
    presetsDesc.style.marginBottom = "15px";

    this.displayPresets();

    // ===== Dangerous Settings Section =====
    containerEl.createEl("h3", { text: "Dangerous Settings" });

    const dangerDesc = containerEl.createEl("div", {
      cls: "setting-item-description",
      text: "These actions cannot be undone. Use with caution."
    });
    dangerDesc.style.marginBottom = "15px";
    dangerDesc.style.color = "var(--text-error)";

    new Setting(containerEl)
      .setName("Reset All Presets")
      .setDesc("Reset all presets to factory defaults. This will remove all custom presets and restore only the Default preset.")
      .addButton(button => button
        .setButtonText("Reset to Defaults")
        .setWarning()
        .onClick(async () => {
          const confirmed = await this.showResetConfirmation();
          if (confirmed) {
            this.plugin.settings.presets = [DEFAULT_PRESET];
            await this.plugin.saveSettings();
            this.display();
          }
        }));
  }

  private displayPresets(): void {
    const { containerEl } = this;

    const presetsContainer = containerEl.createDiv("presets-container");

    new Setting(presetsContainer)
      .setName("Manage Presets")
      .setDesc("Create and edit conversion presets")
      .addButton(button => button
        .setButtonText("Make Preset")
        .onClick(() => {
          new PresetEditModal(this.app, this.plugin, null, () => this.display()).open();
        }));

    if (this.plugin.settings.presets.length === 0) {
      presetsContainer.createEl("p", {
        cls: "setting-item-description",
        text: "No presets found. Click 'Make Preset' to create one."
      });
      return;
    }

    this.plugin.settings.presets.forEach((preset, index) => {
      const isDefault = preset.name === "Default";
      const converterLabel = CONVERTER_OPTIONS.find(opt => opt.value === preset.converterType)?.label || preset.converterType;

      new Setting(presetsContainer)
        .setName(preset.name)
        .setDesc(`Converter: ${converterLabel}, ` +
          `Quality: ${(preset.quality * 100).toFixed(0)}%, ` +
          `${preset.enableResize ? `Max: ${preset.maxWidth}x${preset.maxHeight}` : "No resize"}, ` +
          `${preset.enableGrayscale ? "Grayscale" : "Color"}, ` +
          `Folder: "${preset.attachmentFolder}"`)
        .addButton(button => button
          .setButtonText("Edit")
          .onClick(() => {
            new PresetEditModal(this.app, this.plugin, preset, () => this.display()).open();
          }))
        .addButton(button => button
          .setButtonText("Delete")
          .setDisabled(isDefault)
          .onClick(async () => {
            this.plugin.settings.presets.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          }));
    });
  }

  private async showResetConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new ConfirmationModal(this.app, {
        title: "Reset All Presets",
        message: "Are you sure you want to reset all presets to factory defaults?\n\nThis will:\n• Remove all custom presets\n• Keep only the Default preset\n• Cannot be undone",
        confirmText: "Reset to Defaults",
        cancelText: "Cancel",
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
      modal.open();
    });
  }

}

class ConfirmationModal extends Modal {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;

  constructor(app: App, options: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) {
    super(app);
    this.title = options.title;
    this.message = options.message;
    this.confirmText = options.confirmText;
    this.cancelText = options.cancelText;
    this.onConfirm = options.onConfirm;
    this.onCancel = options.onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: this.title });

    const messageEl = contentEl.createEl("p", { cls: "setting-item-description" });
    messageEl.style.whiteSpace = "pre-line";
    messageEl.style.marginBottom = "20px";
    messageEl.setText(this.message);

    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.justifyContent = "flex-end";

    const cancelBtn = buttonContainer.createEl("button", { text: this.cancelText });
    cancelBtn.onclick = () => {
      this.close();
      this.onCancel();
    };

    const confirmBtn = buttonContainer.createEl("button", { text: this.confirmText });
    confirmBtn.classList.add("mod-warning");
    confirmBtn.onclick = () => {
      this.close();
      this.onConfirm();
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class PresetEditModal extends Modal {
  plugin: WasmImageConverterPlugin;
  preset: PresetSettings | null;
  onSave: () => void;
  isEditing: boolean;

  constructor(app: App, plugin: WasmImageConverterPlugin, preset: PresetSettings | null, onSave: () => void) {
    super(app);
    this.plugin = plugin;
    this.preset = preset;
    this.onSave = onSave;
    this.isEditing = preset !== null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: this.isEditing ? "Edit Preset" : "Create Preset" });

    let presetName = this.preset?.name || "";
    let converterType = this.preset?.converterType || ConverterType.WASM_WEBP;
    let quality = this.preset?.quality || 0.8;
    let maxWidth = this.preset?.maxWidth || 1920;
    let maxHeight = this.preset?.maxHeight || 1080;
    let enableResize: boolean = this.preset?.enableResize ?? true;
    let enableGrayscale: boolean = this.preset?.enableGrayscale ?? false;
    let attachmentFolder = this.preset?.attachmentFolder || "Attachments";

    const isDefault = this.preset?.name === "Default";

    new Setting(contentEl)
      .setName("Preset Name")
      .setDesc("Enter a name for this preset")
      .addText(text => text
        .setPlaceholder("My Preset")
        .setValue(presetName)
        .setDisabled(isDefault)
        .onChange((value) => {
          presetName = value;
        }));

    new Setting(contentEl)
      .setName("Converter")
      .setDesc("Select the image converter to use")
      .addDropdown(dropdown => {
        CONVERTER_OPTIONS.forEach(option => {
          dropdown.addOption(option.value, option.label);
        });
        dropdown.setValue(converterType);
        dropdown.onChange((value) => {
          converterType = value as ConverterType;
        });
      });

    new Setting(contentEl)
      .setName("Attachment folder")
      .setDesc("Folder where converted WebP images will be saved")
      .addText(text => text
        .setPlaceholder("Attachments")
        .setValue(attachmentFolder)
        .onChange((value) => {
          attachmentFolder = value || "Attachments";
        }));

    new Setting(contentEl)
      .setName("Quality")
      .setDesc("WebP compression quality (0.1 - 1.0). Higher values mean better quality but larger files.")
      .addText(text => text
        .setPlaceholder("0.8")
        .setValue(String(quality))
        .onChange((value) => {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && numValue >= 0.1 && numValue <= 1.0) {
            quality = numValue;
          }
        }));

    new Setting(contentEl)
      .setName("Convert to grayscale")
      .setDesc("Convert images to grayscale before WebP conversion")
      .addToggle(toggle => toggle
        .setValue(enableGrayscale)
        .onChange((value) => {
          enableGrayscale = value;
        }));

    new Setting(contentEl)
      .setName("Resize")
      .setDesc("Automatically resize images that exceed the maximum dimensions")
      .addToggle(toggle => toggle
        .setValue(enableResize)
        .onChange((value) => {
          enableResize = value;
        }));

    new Setting(contentEl)
      .setName("Maximum width")
      .setDesc("Maximum width in pixels for resized images")
      .addText(text => text
        .setPlaceholder("1920")
        .setValue(String(maxWidth))
        .onChange((value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            maxWidth = numValue;
          }
        }));

    new Setting(contentEl)
      .setName("Maximum height")
      .setDesc("Maximum height in pixels for resized images")
      .addText(text => text
        .setPlaceholder("1080")
        .setValue(String(maxHeight))
        .onChange((value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            maxHeight = numValue;
          }
        }));

    new Setting(contentEl)
      .addButton(button => button
        .setButtonText("Cancel")
        .onClick(() => {
          this.close();
        }))
      .addButton(button => button
        .setButtonText(this.isEditing ? "Save Changes" : "Create Preset")
        .setCta()
        .onClick(async () => {
          if (!presetName.trim()) {
            return;
          }

          const updatedPreset: PresetSettings = {
            name: presetName.trim(),
            converterType,
            quality,
            maxWidth,
            maxHeight,
            enableResize,
            enableGrayscale,
            attachmentFolder,
          };

          if (this.isEditing && this.preset) {
            const index = this.plugin.settings.presets.findIndex(p => p === this.preset);
            if (index !== -1) {
              this.plugin.settings.presets[index] = updatedPreset;
            }
          } else {
            this.plugin.settings.presets.push(updatedPreset);
          }

          await this.plugin.saveSettings();
          this.close();
          this.onSave();
        }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}