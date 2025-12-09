import { App, Notice, setIcon, TFile } from "obsidian";
import { ConverterSettings } from "../settings";
import { saveImageAndInsert, convertAndReplaceFile } from "../file-service";
import { sizePredictionService } from "../prediction/size-predictor";

import { isAnimatedGif } from "../utils/gif-check";
import { DropZone } from "./components/drop-zone";
import { SettingsPanel } from "./components/settings-panel";
import { PreviewArea } from "./components/preview-area";
// import { PreviewArea } from "./components/preview-area"; // Removed as DropZone now handles preview

export async function openImageConverterModal(app: App, baseSettings: ConverterSettings, initialFile: File | null = null, targetTFile: TFile | null = null): Promise<string | undefined> {
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
            borderRadius: "12px", // Slightly more rounded
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            width: "min(450px, 95vw)", // 450px or 95% of viewport
            maxHeight: "90vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column"
        });

        // Header (Title + Close Button)
        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.marginBottom = "15px";

        // Title
        const title = document.createElement("h3");
        title.className = "wasm-image-modal-title";
        title.textContent = "WASM Image Converter";
        title.style.margin = "0";

        // Close Button
        const closeBtn = document.createElement("div");
        closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        closeBtn.style.cursor = "pointer";
        closeBtn.style.color = "var(--text-muted)";
        closeBtn.style.display = "flex";
        closeBtn.onclick = () => cleanupAndResolve(undefined); // Close action

        header.appendChild(title);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // Components
        let selectedFile: File | null = null;

        // Info Div (for prediction and file size)
        const infoDiv = document.createElement("div");
        infoDiv.className = "wasm-image-preview-info";
        // Style it to be centered or prominent
        infoDiv.style.marginTop = "10px";
        infoDiv.style.marginBottom = "10px";
        infoDiv.style.textAlign = "center";

        const updatePrediction = async () => {
            if (!selectedFile) {
                infoDiv.textContent = "";
                return;
            }

            const originalKB = (selectedFile.size / 1024).toFixed(1);
            let infoText = `${selectedFile.name}: ${originalKB}kB`;

            try {
                const currentSettings = settingsPanel.getSettings();

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

                    infoText += ` → Expected: ${predictedKB}kB (-${compressionRatio}%)`;
                }
            } catch (error) {
                console.warn('Size prediction failed:', error);
            }

            infoDiv.innerHTML = infoText;
            // Also color accent part
            const ratioMatch = infoText.match(/Expected.*$/);
            if (ratioMatch) {
                infoDiv.innerHTML = infoText.replace(ratioMatch[0], `<span style="color: var(--text-accent);">${ratioMatch[0]}</span>`);
            }
        };

        const handleFileSelect = async (file: File) => {
            if (!file || !file.type.startsWith("image/")) {
                new Notice("❌ Please select a valid image file");
                return;
            }

            if (file.type === 'image/gif' && await isAnimatedGif(file)) {
                new Notice("⚠️ Animated GIF detected. Conversion will result in a static image (first frame only).");
            }

            selectedFile = file;
            convertBtn.disabled = false;

            dropZone.showPreview(file);
            updatePrediction();
        };

        const dropZone = new DropZone(handleFileSelect);

        // Source Buttons (Paste / Import)
        const sourceBtnRow = document.createElement("div");
        sourceBtnRow.className = "wasm-image-drop-zone-buttons";
        sourceBtnRow.style.marginTop = "15px";
        sourceBtnRow.style.marginBottom = "0px";

        const pasteBtn = document.createElement("button");
        pasteBtn.className = "wasm-image-btn wasm-image-drop-btn";
        pasteBtn.style.flex = "1";
        pasteBtn.onclick = () => dropZone.handleClipboardPaste();
        // Icon + Text
        const pasteIcon = document.createElement("span");
        pasteIcon.className = "wasm-image-btn-icon";
        setIcon(pasteIcon, "clipboard-paste"); // or 'paste'
        const pasteText = document.createElement("span");
        pasteText.textContent = " Paste from Clipboard";
        pasteBtn.appendChild(pasteIcon);
        pasteBtn.appendChild(pasteText);


        const importBtn = document.createElement("button");
        importBtn.className = "wasm-image-btn wasm-image-drop-btn";
        importBtn.style.flex = "1";
        importBtn.onclick = () => dropZone.triggerFileInput();
        const importIcon = document.createElement("span");
        importIcon.className = "wasm-image-btn-icon";
        setIcon(importIcon, "download"); // Changed to download
        const importText = document.createElement("span");
        importText.textContent = " Import from system";
        importBtn.appendChild(importIcon);
        importBtn.appendChild(importText);

        sourceBtnRow.appendChild(pasteBtn);
        sourceBtnRow.appendChild(importBtn);

        // Settings Panel
        const settingsPanel = new SettingsPanel(settings, () => {
            updatePrediction();
        });

        // ===== Layout Assembly (Vertical Stack) =====
        // 1. Header (Title + Close) - Added above

        // 2. Settings
        modal.appendChild(settingsPanel.getElement());

        // 3. Source Buttons (Only if not in context menu mode)
        if (!initialFile) {
            modal.appendChild(sourceBtnRow);
        } else {
            dropZone.setDisabled(true);
        }

        // 4. Drop Zone (Doubles as Preview, D&D only)
        // Adjust drop zone top margin
        dropZone.getElement().style.marginTop = initialFile ? "15px" : "8px";
        modal.appendChild(dropZone.getElement());

        // 5. Info
        modal.appendChild(infoDiv);

        // 6. Buttons
        const btnRow = document.createElement("div");
        btnRow.className = "wasm-image-btn-row";
        btnRow.style.justifyContent = "center"; // Center the single button (or right align)
        // With no cancel button, maybe full width convert button? 
        // User didn't specify, but "Convert & Insert" might look best full width or right aligned.
        // Let's make it full width for easy mobile tap.

        const convertBtn = document.createElement("button");
        convertBtn.textContent = targetTFile ? "Convert" : "Convert & Insert";
        convertBtn.className = "wasm-image-btn mod-cta";
        convertBtn.style.width = "100%"; // Full width cta
        convertBtn.style.justifyContent = "center";
        convertBtn.disabled = true;

        btnRow.appendChild(convertBtn);

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

                let result;
                let markdownLink;

                if (targetTFile) {
                    // Replace mode (Context Menu)
                    result = await convertAndReplaceFile(
                        app,
                        targetTFile,
                        selectedFile,
                        currentSettings,
                        settingsPanel.quality,
                        settingsPanel.enableResize,
                        settingsPanel.maxWidth,
                        settingsPanel.maxHeight,
                        settingsPanel.enableGrayscale,
                        settingsPanel.converterType
                    );
                    new Notice(`✅ Image replaced: ${result.path}`);
                    markdownLink = `![[${result.path}]]`; // Provide updated link
                } else {
                    // Insert mode (Drag & Drop / Command)
                    result = await saveImageAndInsert(
                        app,
                        selectedFile,
                        currentSettings,
                        settingsPanel.quality,
                        settingsPanel.enableResize,
                        settingsPanel.maxWidth,
                        settingsPanel.maxHeight,
                        settingsPanel.enableGrayscale,
                        settingsPanel.converterType
                    );
                    markdownLink = `![[${result.path}]]`;
                }

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

        // Initialize with file if provided
        if (initialFile) {
            handleFileSelect(initialFile);
        }

        // Mount
        document.body.appendChild(modal);

        // Auto read clipboard (only if no initial file)
        if (baseSettings.autoReadClipboard && !initialFile) {
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
                                new Notice("✅ Clipboard image detected");
                                return;
                            }
                        }
                    }
                } catch (err) {
                    // Silent fail
                }
            })();
        }
    });
}
