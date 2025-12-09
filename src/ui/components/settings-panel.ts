import { ConverterSettings, ConverterType, CONVERTER_OPTIONS, PresetSettings } from "../../settings";

export class SettingsPanel {
    element: HTMLDivElement;
    private settings: ConverterSettings;
    private onChange: () => void;

    private presetSelect!: HTMLSelectElement;
    private converterSelect!: HTMLSelectElement;
    private qualityInput!: HTMLInputElement;
    private resizeCheckbox!: HTMLInputElement;
    private maxWInput!: HTMLInputElement;
    private maxHInput!: HTMLInputElement;
    private grayscaleCheckbox!: HTMLInputElement;
    private folderInfo!: HTMLDivElement;

    constructor(settings: ConverterSettings, onChange: () => void) {
        this.settings = settings;
        this.onChange = onChange;
        this.element = document.createElement("div");
        this.render();
    }

    private render() {
        this.element.className = "wasm-image-right-col";

        // Preset
        this.presetSelect = this.createSelect("Preset:", (val) => this.handlePresetChange(val));
        // Add Default option
        const defaultOption = document.createElement("option");
        defaultOption.value = "default";
        defaultOption.textContent = "Default";
        this.presetSelect.appendChild(defaultOption);
        // Add other presets
        this.settings.presets.forEach((preset, index) => {
            if (preset.name !== "Default") {
                const option = document.createElement("option");
                option.value = String(index);
                option.textContent = preset.name;
                this.presetSelect.appendChild(option);
            }
        });

        // Converter
        this.converterSelect = this.createSelect("Converter:", (val) => {
            this.settings.converterType = val as ConverterType;
            this.presetSelect.value = "default";
            this.notifyChange();
        });
        CONVERTER_OPTIONS.forEach(option => {
            const opt = document.createElement("option");
            opt.value = option.value;
            opt.textContent = option.label;
            this.converterSelect.appendChild(opt);
        });
        this.converterSelect.value = this.settings.converterType;

        // Quality
        this.qualityInput = this.createNumberInput("Quality:", 0.1, 1.0, 0.1, this.settings.quality, (val) => {
            this.settings.quality = val;
            this.presetSelect.value = "default";
            this.notifyChange();
        });

        // Grayscale
        this.grayscaleCheckbox = this.createCheckbox("Grayscale", this.settings.enableGrayscale, (checked) => {
            this.settings.enableGrayscale = checked;
            this.presetSelect.value = "default";
            this.notifyChange();
        });

        // Resize
        this.resizeCheckbox = this.createCheckbox("Resize", this.settings.enableResize, (checked) => {
            this.settings.enableResize = checked;
            this.presetSelect.value = "default";
            this.notifyChange();
        });

        // Max Width
        this.maxWInput = this.createNumberInput("Max Width:", 100, 5000, 1, this.settings.maxWidth, (val) => {
            this.settings.maxWidth = val;
            this.presetSelect.value = "default";
            this.notifyChange();
        });
        this.maxWInput.placeholder = "1920";

        // Max Height
        this.maxHInput = this.createNumberInput("Max Height:", 100, 5000, 1, this.settings.maxHeight, (val) => {
            this.settings.maxHeight = val;
            this.presetSelect.value = "default";
            this.notifyChange();
        });
        this.maxHInput.placeholder = "1080";

        // Folder Info
        this.folderInfo = document.createElement("div");
        this.folderInfo.className = "wasm-image-folder-info";
        this.folderInfo.textContent = `Save to: ${this.settings.attachmentFolder}/`;
        this.element.appendChild(this.folderInfo);
    }

    private createSelect(label: string, onChange: (val: string) => void): HTMLSelectElement {
        const row = document.createElement("div");
        row.className = "wasm-image-setting-row";

        const lbl = document.createElement("label");
        lbl.className = "wasm-image-setting-label";
        lbl.textContent = label;

        const select = document.createElement("select");
        select.className = "wasm-image-setting-control";
        select.addEventListener("change", () => onChange(select.value));

        row.appendChild(lbl);
        row.appendChild(select);
        this.element.appendChild(row);
        return select;
    }

    private createNumberInput(label: string, min: number, max: number, step: number, initial: number, onChange: (val: number) => void): HTMLInputElement {
        const row = document.createElement("div");
        row.className = "wasm-image-setting-row";

        const lbl = document.createElement("label");
        lbl.className = "wasm-image-setting-label";
        lbl.textContent = label;

        const input = document.createElement("input");
        input.type = "number";
        input.className = "wasm-image-setting-control";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(initial);

        input.addEventListener("change", () => onChange(parseFloat(input.value) || 0));

        row.appendChild(lbl);
        row.appendChild(input);
        this.element.appendChild(row);
        return input;
    }

    private createCheckbox(label: string, initial: boolean, onChange: (checked: boolean) => void): HTMLInputElement {
        const row = document.createElement("div");
        row.className = "wasm-image-setting-row";

        const text = document.createElement("label");
        text.className = "wasm-image-checkbox-label";
        text.textContent = label;

        const container = document.createElement("div");
        container.className = "wasm-image-checkbox-container";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = initial;

        // Allow clicking label to toggle
        const id = `cb-${label}-${Math.random().toString(36).substr(2, 9)}`;
        checkbox.id = id;
        text.htmlFor = id;

        checkbox.addEventListener("change", () => onChange(checkbox.checked));

        container.appendChild(checkbox);
        row.appendChild(text);
        row.appendChild(container);
        this.element.appendChild(row);
        return checkbox;
    }

    private handlePresetChange(val: string) {
        if (val === "default") {
            const defaultPreset = this.settings.presets.find(p => p.name === "Default");
            if (defaultPreset) this.applyPreset(defaultPreset);
        } else {
            const presetIndex = parseInt(val);
            const selectedPreset = this.settings.presets[presetIndex];
            if (selectedPreset) this.applyPreset(selectedPreset);
        }
        this.notifyChange();
    }

    private applyPreset(preset: PresetSettings) {
        this.settings.converterType = preset.converterType;
        this.settings.quality = preset.quality;
        this.settings.maxWidth = preset.maxWidth;
        this.settings.maxHeight = preset.maxHeight;
        this.settings.enableResize = preset.enableResize;
        this.settings.enableGrayscale = preset.enableGrayscale;
        this.settings.attachmentFolder = preset.attachmentFolder;

        // Update UI
        this.converterSelect.value = preset.converterType;
        this.qualityInput.value = String(preset.quality);
        this.maxWInput.value = String(preset.maxWidth);
        this.maxHInput.value = String(preset.maxHeight);
        this.resizeCheckbox.checked = preset.enableResize;
        this.grayscaleCheckbox.checked = preset.enableGrayscale;
        this.folderInfo.textContent = `Save to: ${preset.attachmentFolder}/`;
    }

    private notifyChange() {
        this.onChange();
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public getSettings(): ConverterSettings {
        return this.settings;
    }

    // getters for current values if needed directly
    public get quality() { return parseFloat(this.qualityInput.value) || this.settings.quality; }
    public get maxWidth() { return parseInt(this.maxWInput.value) || this.settings.maxWidth; }
    public get maxHeight() { return parseInt(this.maxHInput.value) || this.settings.maxHeight; }
    public get enableResize() { return this.resizeCheckbox.checked; }
    public get enableGrayscale() { return this.grayscaleCheckbox.checked; }
    public get converterType() { return this.converterSelect.value as ConverterType; }
}
