import { Notice } from "obsidian";

export class DropZone {
    element: HTMLDivElement;
    private onFilesSelected: (files: File[]) => void;

    private contentContainer: HTMLDivElement;
    private currentObjectUrls: string[] = [];
    private fileInput: HTMLInputElement;
    private isDisabled: boolean = false;
    private selectedFiles: File[] = [];

    constructor(onFilesSelected: (files: File[]) => void) {
        this.onFilesSelected = onFilesSelected;
        this.element = document.createElement("div");
        this.contentContainer = document.createElement("div");
        this.contentContainer.className = "wasm-image-drop-zone-content";

        // File input (created once)
        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.accept = "image/*";
        this.fileInput.multiple = true;
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
            if (this.fileInput.files && this.fileInput.files.length > 0) {
                const newFiles = Array.from(this.fileInput.files);
                this.addFiles(newFiles);
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
                const newFiles = Array.from(files);
                this.addFiles(newFiles);
            }
        });
    }

    private addFiles(newFiles: File[]) {
        // Filter to only image files
        const imageFiles = newFiles.filter(f => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return;

        // Add to existing selection
        this.selectedFiles = [...this.selectedFiles, ...imageFiles];
        this.updatePreview();
        this.onFilesSelected(this.selectedFiles);
    }

    public removeFile(index: number) {
        this.selectedFiles.splice(index, 1);
        this.updatePreview();
        this.onFilesSelected(this.selectedFiles);
    }

    private updatePreview() {
        // Clean up old URLs
        this.revokeAllUrls();

        if (this.selectedFiles.length === 0) {
            this.showPlaceholder();
            return;
        }

        this.contentContainer.innerHTML = "";

        if (this.selectedFiles.length === 1) {
            // Single file: show large preview (same as original behavior)
            const url = URL.createObjectURL(this.selectedFiles[0]);
            this.currentObjectUrls.push(url);

            const img = document.createElement("img");
            img.src = url;
            img.className = "wasm-image-preview-img";
            img.title = "Drag & drop to replace";
            this.contentContainer.appendChild(img);
        } else {
            // Multiple files: show thumbnail grid
            const grid = document.createElement("div");
            grid.className = "wasm-image-thumbnail-grid";

            this.selectedFiles.forEach((file, index) => {
                const thumb = document.createElement("div");
                thumb.className = "wasm-image-thumbnail-item";

                const url = URL.createObjectURL(file);
                this.currentObjectUrls.push(url);

                const img = document.createElement("img");
                img.src = url;
                img.className = "wasm-image-thumbnail-img";
                img.title = file.name;

                const removeBtn = document.createElement("button");
                removeBtn.className = "wasm-image-thumbnail-remove";
                removeBtn.textContent = "\u00d7";
                removeBtn.title = "Remove";
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.removeFile(index);
                };

                thumb.appendChild(img);
                thumb.appendChild(removeBtn);
                grid.appendChild(thumb);
            });

            this.contentContainer.appendChild(grid);
        }
    }

    public showPlaceholder() {
        this.contentContainer.innerHTML = `
      <div class="wasm-image-drop-zone-icon">\ud83d\udcf7</div>
      <div style="margin-bottom: 5px;">Drag & drop images here</div>
      <div class="wasm-image-drop-zone-subtext">
        Supported: JPG, PNG, GIF, BMP, TIFF (multiple files supported)
      </div>
    `;

        this.revokeAllUrls();
        this.selectedFiles = [];
    }

    private revokeAllUrls() {
        this.currentObjectUrls.forEach(url => URL.revokeObjectURL(url));
        this.currentObjectUrls = [];
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
                        this.addFiles([file]);
                        new Notice("\u2705 Clipboard image added");
                        return;
                    }
                }
            }
            new Notice("\u274c No image found in clipboard");
        } catch (err) {
            console.log("Clipboard read failed:", err);
            new Notice("\u274c Failed to read clipboard. Try using drag & drop instead.");
        }
    }

    public triggerFileInput() {
        this.fileInput.click();
    }

    /** Show preview for a single file (used by initial file from context menu) */
    public showPreview(file: File) {
        this.selectedFiles = [file];
        this.updatePreview();
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public getSelectedFiles(): File[] {
        return this.selectedFiles;
    }
}
