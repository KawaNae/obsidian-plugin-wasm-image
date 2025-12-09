import { App, Notice } from "obsidian";
import { ConverterSettings } from "../settings";
import { saveImageAndInsert } from "../file-service";
import { sizePredictionService } from "../prediction/size-predictor";
import { DropZone, ClipboardButton } from "./components/drop-zone";
import { SettingsPanel } from "./components/settings-panel";
import { PreviewArea } from "./components/preview-area";

export async function openImageConverterModal(app: App, baseSettings: ConverterSettings): Promise<string | undefined> {
    // Clone settings
    const settings: ConverterSettings = { ...baseSettings };

    return new Promise((resolve) => {
        // ===== Modal Root =====
        const modal = document.createElement("div");
        modal.className = "wasm-image-modal";
        Object.assign(modal.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: "9999",
            background: "var(--background-primary)",
            border: "1px solid var(--background-modifier-border)",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        });

        // Title
        const title = document.createElement("h3");
        title.className = "wasm-image-modal-title";
        title.textContent = "WASM Image Converter";
        modal.appendChild(title);

        // ===== Content Area =====
        const content = document.createElement("div");
        content.className = "wasm-image-content";

        // Left Column
        const leftCol = document.createElement("div");
        leftCol.className = "wasm-image-left-col";

        // Components
        let selectedFile: File | null = null;

        const updatePrediction = async () => {
            if (!selectedFile) {
                previewArea.updatePreview(null);
                return;
            }

            const originalKB = (selectedFile.size / 1024).toFixed(1);
            let infoText = `${selectedFile.name}: ${originalKB}kB`;

            try {
                const currentSettings = settingsPanel.getSettings();
                // Ensure we use values from UI inputs as they might be typed in
                const predictionResult = await sizePredictionService.predictSize(selectedFile, {
                    converterType: settingsPanel.converterType,
                    quality: settingsPanel.quality,
                    enableGrayscale: settingsPanel.enableGrayscale,
                    enableResize: settingsPanel.enableResize,
                    maxWidth: settingsPanel.maxWidth,
                    maxHeight: settingsPanel.maxHeight
                });

                if (predictionResult) {
                    const predictedKB = (predictionResult.predictedSize / 1024).toFixed(1);
                    const compressionRatio = ((selectedFile.size - predictionResult.predictedSize) / selectedFile.size * 100).toFixed(0);

                    infoText += ` → <span style="color: var(--text-accent);">Expected: ${predictedKB}kB (-${compressionRatio}%)</span>`;
                }
            } catch (error) {
                console.warn('Size prediction failed:', error);
            }

            previewArea.updateInfo(infoText);
        };

        const handleFileSelect = (file: File) => {
            if (!file || !file.type.startsWith("image/")) {
                new Notice("❌ Please select a valid image file");
                return;
            }
            selectedFile = file;
            convertBtn.disabled = false;

            previewArea.updatePreview(file);
            updatePrediction();
        };

        const dropZone = new DropZone(handleFileSelect);
        const clipboardBtn = new ClipboardButton(handleFileSelect);

        leftCol.appendChild(dropZone.getElement());
        leftCol.appendChild(clipboardBtn.getElement());

        // Right Column (Settings)
        const settingsPanel = new SettingsPanel(settings, () => {
            updatePrediction();
        });

        content.appendChild(leftCol);
        content.appendChild(settingsPanel.getElement());
        modal.appendChild(content);

        // Preview
        const previewArea = new PreviewArea();
        modal.appendChild(previewArea.getElement());

        // ===== Buttons =====
        const btnRow = document.createElement("div");
        btnRow.className = "wasm-image-btn-row";

        const convertBtn = document.createElement("button");
        convertBtn.textContent = "Convert & Insert";
        convertBtn.className = "wasm-image-btn mod-cta"; // Added mod-cta
        convertBtn.disabled = true;

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "wasm-image-btn";

        btnRow.appendChild(convertBtn);
        btnRow.appendChild(cancelBtn);
        modal.appendChild(btnRow);

        // ===== Logic =====
        function cleanupAndResolve(val?: string) {
            modal.remove();
            resolve(val);
        }

        convertBtn.addEventListener("click", async () => {
            if (!selectedFile) return;
            try {
                convertBtn.disabled = true;
                convertBtn.textContent = "Converting...";

                const currentSettings = settingsPanel.getSettings();

                const result = await saveImageAndInsert(
                    app,
                    selectedFile,
                    settings, // Use settings object which has been updated by settingsPanel
                    settingsPanel.quality,
                    settingsPanel.enableResize,
                    settingsPanel.maxWidth,
                    settingsPanel.maxHeight,
                    settingsPanel.enableGrayscale,
                    settingsPanel.converterType
                );
                const fileName = result.path.split("/").pop()!;
                const markdownLink = `![[${fileName}]]`;

                cleanupAndResolve(markdownLink);

                const originalKB = (result.originalSize / 1024).toFixed(2);
                const convertedKB = (result.convertedSize / 1024).toFixed(2);
                const ratio = (((result.originalSize - result.convertedSize) / result.originalSize) * 100).toFixed(1);
                new Notice(`✅ Image converted: ${originalKB}KB → ${convertedKB}KB (${ratio}% compressed)`);
            } catch (error) {
                console.error("Image conversion failed:", error);
                new Notice("❌ Image conversion failed");
                convertBtn.disabled = false;
                convertBtn.textContent = "Convert & Insert";
            }
        });

        cancelBtn.addEventListener("click", () => cleanupAndResolve(undefined));

        // Mount
        document.body.appendChild(modal);

        // Auto read clipboard
        if (baseSettings.autoReadClipboard) {
            (async () => {
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
                                handleFileSelect(file);
                                return;
                            }
                        }
                    }
                } catch { }
            })();
        }
    });
}
