import { Notice } from "obsidian";

export class DropZone {
    element: HTMLDivElement;
    private onFileSelected: (file: File) => void;

    private contentContainer: HTMLDivElement;
    private previewImage: HTMLImageElement | null = null;
    private currentObjectUrl: string | null = null;
    private fileInput: HTMLInputElement;
    private isDisabled: boolean = false;

    constructor(onFileSelected: (file: File) => void) {
        this.onFileSelected = onFileSelected;
        this.element = document.createElement("div");
        this.contentContainer = document.createElement("div");
        this.contentContainer.className = "wasm-image-drop-zone-content";

        // File input (created once)
        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.accept = "image/*";
        this.fileInput.style.display = "none";
        this.element.appendChild(this.fileInput);

        this.render();
    }

    public setDisabled(disabled: boolean) {
        this.isDisabled = disabled;
        if (disabled) {
            this.element.classList.add("disabled");
            this.fileInput.disabled = true;
        } else {
            this.element.classList.remove("disabled");
            this.fileInput.disabled = false;
        }
    }

    private render() {
        this.element.className = "wasm-image-drop-zone";
        this.element.appendChild(this.contentContainer);

        this.showPlaceholder();

        this.fileInput.addEventListener("change", () => {
            if (this.isDisabled) return;
            if (this.fileInput.files && this.fileInput.files[0]) {
                const file = this.fileInput.files[0];
                this.onFileSelected(file);
                this.showPreview(file);
                // Reset input so same file can be selected again if needed
                this.fileInput.value = '';
            }
        });

        this.element.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (this.isDisabled) return;
            this.element.classList.add("drag-over");
        });

        this.element.addEventListener("dragleave", () => {
            if (this.isDisabled) return;
            this.element.classList.remove("drag-over");
        });

        this.element.addEventListener("drop", (e) => {
            e.preventDefault();
            if (this.isDisabled) return;
            this.element.classList.remove("drag-over");
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0];
                this.onFileSelected(file);
                this.showPreview(file);
            }
        });
    }

    public showPlaceholder() {
        this.contentContainer.innerHTML = `
      <div class="wasm-image-drop-zone-icon">📷</div>
      <div style="margin-bottom: 5px;">Drag & drop image here</div>
      <div class="wasm-image-drop-zone-subtext">
        Supported: JPG, PNG, GIF, BMP, TIFF
      </div>
    `;

        if (this.currentObjectUrl) {
            URL.revokeObjectURL(this.currentObjectUrl);
            this.currentObjectUrl = null;
        }
        this.previewImage = null;
    }

    public async handleClipboardPaste() {
        try {
            // @ts-ignore
            const items = await navigator.clipboard.read();
            for (const it of items) {
                // @ts-ignore
                for (const t of it.types) {
                    if (t.startsWith("image/")) {
                        // @ts-ignore
                        const blob = await it.getType(t);
                        const file = new File([blob], `clipboard-${Date.now()}.${t.split("/")[1]}`, { type: t });
                        this.onFileSelected(file);
                        this.showPreview(file);
                        new Notice("✅ Clipboard image updated");
                        return;
                    }
                }
            }
            new Notice("❌ No image found in clipboard");
        } catch (err) {
            console.log("Clipboard read failed:", err);
            new Notice("❌ Failed to read clipboard. Try using drag & drop instead.");
        }
    }

    public triggerFileInput() {
        this.fileInput.click();
    }

    public showPreview(file: File) {
        if (this.currentObjectUrl) {
            URL.revokeObjectURL(this.currentObjectUrl);
        }
        this.currentObjectUrl = URL.createObjectURL(file);

        this.contentContainer.innerHTML = "";

        this.previewImage = document.createElement("img");
        this.previewImage.src = this.currentObjectUrl;
        this.previewImage.className = "wasm-image-preview-img";
        this.previewImage.title = "Drag & drop to replace";

        this.contentContainer.appendChild(this.previewImage);
    }

    public getElement(): HTMLElement {
        return this.element;
    }
}
