import { Notice } from "obsidian";

export class DropZone {
    element: HTMLDivElement;
    private onFileSelected: (file: File) => void;

    constructor(onFileSelected: (file: File) => void) {
        this.onFileSelected = onFileSelected;
        this.element = document.createElement("div");
        this.render();
    }

    private render() {
        this.element.className = "wasm-image-drop-zone";
        this.element.innerHTML = `
      <div class="wasm-image-drop-zone-icon">📷</div>
      <div>Click to select image or drag & drop</div>
      <div class="wasm-image-drop-zone-subtext">
        Supported: JPG, PNG, GIF, BMP, TIFF
      </div>
    `;

        // File input
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        this.element.appendChild(fileInput);

        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files[0]) {
                this.onFileSelected(fileInput.files[0]);
                // Reset input so same file can be selected again if needed
                fileInput.value = '';
            }
        });

        // Events
        this.element.addEventListener("click", (e) => {
            // Prevent click from triggering if we clicked children that might handle it differently (though here it's fine)
            if (e.target !== fileInput) fileInput.click();
        });

        this.element.addEventListener("dragover", (e) => {
            e.preventDefault();
            this.element.classList.add("drag-over");
        });

        this.element.addEventListener("dragleave", () => {
            this.element.classList.remove("drag-over");
        });

        this.element.addEventListener("drop", (e) => {
            e.preventDefault();
            this.element.classList.remove("drag-over");
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                this.onFileSelected(files[0]);
            }
        });
    }

    public getElement(): HTMLElement {
        return this.element;
    }
}

export class ClipboardButton {
    element: HTMLButtonElement;
    private onFileSelected: (file: File) => void;

    constructor(onFileSelected: (file: File) => void) {
        this.onFileSelected = onFileSelected;
        this.element = document.createElement("button");
        this.render();
    }

    private render() {
        this.element.textContent = "📋 Paste from Clipboard";
        this.element.className = "wasm-image-clipboard-btn";

        this.element.addEventListener("click", async () => {
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
        });
    }

    public getElement(): HTMLElement {
        return this.element;
    }
}
