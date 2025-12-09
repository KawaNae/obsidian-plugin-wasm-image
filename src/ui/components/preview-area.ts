export class PreviewArea {
    element: HTMLDivElement;
    previewImage: HTMLImageElement | null = null;
    infoDiv: HTMLDivElement;

    constructor() {
        this.element = document.createElement("div");
        this.element.className = "wasm-image-preview";

        this.infoDiv = document.createElement("div");
        this.infoDiv.className = "wasm-image-preview-info";
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public updatePreview(file: File | null) {
        this.element.innerHTML = ""; // Clear current

        if (!file) {
            this.previewImage = null;
            this.element.appendChild(this.infoDiv); // Keep info div even if empty
            this.updateInfo("");
            return;
        }

        this.previewImage = document.createElement("img");
        this.previewImage.src = URL.createObjectURL(file);
        this.previewImage.className = "wasm-image-preview-img";

        this.element.appendChild(this.previewImage);
        this.element.appendChild(this.infoDiv);
    }

    public updateInfo(html: string) {
        this.infoDiv.innerHTML = html;
    }
}
