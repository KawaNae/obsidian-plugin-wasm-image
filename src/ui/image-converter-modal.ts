import { App, Notice, setIcon, TFile } from "obsidian";
import { ConverterSettings } from "../settings";
import { saveImageAndInsert, convertAndReplaceFile } from "../file-service";
import { sizePredictionService } from "../prediction/size-predictor";

import { isAnimatedGif } from "../utils/gif-check";
import { DropZone } from "./components/drop-zone";
import { SettingsPanel } from "./components/settings-panel";
import { PreviewArea } from "./components/preview-area";

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
            borderRadius: "12px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            width: "min(450px, 95vw)",
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
        title.className = "wasm-image-modal__title";
        title.textContent = "Image Converter";
        title.style.margin = "0";

        // Close Button
        const closeBtn = document.createElement("div");
        setIcon(closeBtn, "x");
        closeBtn.style.cursor = "pointer";
        closeBtn.style.color = "var(--text-muted)";
        closeBtn.style.display = "flex";
        closeBtn.onclick = () => cleanupAndResolve(undefined);

        header.appendChild(title);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // Components
        let selectedFiles: File[] = [];

        // Info Div (for prediction and file size)
        const infoDiv = document.createElement("div");
        infoDiv.className = "wasm-image-preview__info";
        infoDiv.style.marginTop = "10px";
        infoDiv.style.marginBottom = "10px";
        infoDiv.style.textAlign = "center";

        // Progress bar container (hidden by default)
        const progressContainer = document.createElement("div");
        progressContainer.className = "wasm-image-progress";
        progressContainer.style.display = "none";

        const progressBar = document.createElement("div");
        progressBar.className = "wasm-image-progress__bar";
        const progressFill = document.createElement("div");
        progressFill.className = "wasm-image-progress__fill";
        progressBar.appendChild(progressFill);

        const progressText = document.createElement("div");
        progressText.className = "wasm-image-progress__text";

        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);

        const updatePrediction = async () => {
            if (selectedFiles.length === 0) {
                infoDiv.textContent = "";
                return;
            }

            if (selectedFiles.length === 1) {
                // Single file: show detailed info
                const file = selectedFiles[0];
                const originalKB = (file.size / 1024).toFixed(1);

                let predictionText = '';
                try {
                    const predictionResult = await sizePredictionService.predictSize(file, {
                        converterType: settingsPanel.converterType,
                        quality: settingsPanel.quality,
                        enableGrayscale: settingsPanel.enableGrayscale,
                        enableResize: settingsPanel.enableResize,
                        maxWidth: settingsPanel.maxWidth,
                        maxHeight: settingsPanel.maxHeight
                    });

                    if (predictionResult) {
                        const predictedKB = (predictionResult.predictedSize / 1024).toFixed(1);
                        const compressionRatio = ((file.size - predictionResult.predictedSize) / file.size * 100).toFixed(0);
                        predictionText = ` \u2192 Expected: ${predictedKB}kB (-${compressionRatio}%)`;
                    }
                } catch (error) {
                    console.warn('Size prediction failed:', error);
                }

                infoDiv.textContent = '';
                infoDiv.appendChild(document.createTextNode(`${file.name}: ${originalKB}kB`));
                if (predictionText) {
                    const span = document.createElement('span');
                    span.style.color = 'var(--text-accent)';
                    span.textContent = predictionText;
                    infoDiv.appendChild(span);
                }
            } else {
                // Multiple files: show aggregate info
                const totalSizeKB = (selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1);
                infoDiv.textContent = `${selectedFiles.length} images selected (${totalSizeKB}kB total)`;
            }
        };

        const updateConvertButton = () => {
            if (selectedFiles.length === 0) {
                convertBtn.disabled = true;
                convertBtn.textContent = targetTFile ? "Convert" : "Convert & Insert";
            } else if (targetTFile) {
                convertBtn.disabled = false;
                convertBtn.textContent = "Convert";
            } else if (selectedFiles.length === 1) {
                convertBtn.disabled = false;
                convertBtn.textContent = "Convert & Insert";
            } else {
                convertBtn.disabled = false;
                convertBtn.textContent = `Convert & Insert (${selectedFiles.length} images)`;
            }
        };

        const handleFilesSelect = async (files: File[]) => {
            // Validate files
            const validFiles = files.filter(f => f.type.startsWith("image/"));
            if (validFiles.length === 0) {
                new Notice("\u274c Please select valid image files");
                return;
            }

            // Check for animated GIFs
            for (const file of validFiles) {
                if (file.type === 'image/gif' && await isAnimatedGif(file)) {
                    new Notice("\u26a0\ufe0f Animated GIF detected. Conversion will result in a static image (first frame only).");
                    break;
                }
            }

            selectedFiles = validFiles;
            updateConvertButton();
            updatePrediction();
        };

        const dropZone = new DropZone(handleFilesSelect);

        // Source Buttons (Paste / Import)
        const sourceBtnRow = document.createElement("div");
        sourceBtnRow.className = "wasm-image-drop-zone__buttons";
        sourceBtnRow.style.marginTop = "15px";
        sourceBtnRow.style.marginBottom = "0px";

        const pasteBtn = document.createElement("button");
        pasteBtn.className = "wasm-image-modal__btn wasm-image-drop-zone__btn";
        pasteBtn.style.flex = "1";
        pasteBtn.onclick = () => dropZone.handleClipboardPaste();
        const pasteIcon = document.createElement("span");
        pasteIcon.className = "wasm-image-modal__btn-icon";
        setIcon(pasteIcon, "clipboard-paste");
        const pasteText = document.createElement("span");
        pasteText.textContent = " Paste from Clipboard";
        pasteBtn.appendChild(pasteIcon);
        pasteBtn.appendChild(pasteText);

        const importBtn = document.createElement("button");
        importBtn.className = "wasm-image-modal__btn wasm-image-drop-zone__btn";
        importBtn.style.flex = "1";
        importBtn.onclick = () => dropZone.triggerFileInput();
        const importIcon = document.createElement("span");
        importIcon.className = "wasm-image-modal__btn-icon";
        setIcon(importIcon, "download");
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
        modal.appendChild(settingsPanel.getElement());

        if (!initialFile) {
            modal.appendChild(sourceBtnRow);
        } else {
            dropZone.setDisabled(true);
        }

        dropZone.getElement().style.marginTop = initialFile ? "15px" : "8px";
        modal.appendChild(dropZone.getElement());

        modal.appendChild(infoDiv);
        modal.appendChild(progressContainer);

        // Convert Button
        const btnRow = document.createElement("div");
        btnRow.className = "wasm-image-modal__btn-row";
        btnRow.style.justifyContent = "center";

        const convertBtn = document.createElement("button");
        convertBtn.textContent = targetTFile ? "Convert" : "Convert & Insert";
        convertBtn.className = "wasm-image-modal__btn mod-cta";
        convertBtn.style.width = "100%";
        convertBtn.style.justifyContent = "center";
        convertBtn.disabled = true;

        btnRow.appendChild(convertBtn);
        modal.appendChild(btnRow);

        // ===== Logic =====
        function cleanupAndResolve(val?: string) {
            dropZone.dispose();
            modal.remove();
            resolve(val);
        }

        convertBtn.addEventListener("click", async () => {
            if (selectedFiles.length === 0) return;
            try {
                convertBtn.disabled = true;
                const currentSettings = settingsPanel.getSettings();

                if (targetTFile) {
                    // Replace mode (Context Menu) - single file only
                    const file = selectedFiles[0];
                    convertBtn.textContent = "Converting...";

                    const result = await convertAndReplaceFile(
                        app,
                        targetTFile,
                        file,
                        currentSettings,
                        settingsPanel.quality,
                        settingsPanel.enableResize,
                        settingsPanel.maxWidth,
                        settingsPanel.maxHeight,
                        settingsPanel.enableGrayscale,
                        settingsPanel.converterType
                    );

                    new Notice(`\u2705 Image replaced: ${result.path}`);
                    const markdownLink = `![[${result.path}]]`;

                    cleanupAndResolve(markdownLink);

                    const originalKB = (result.originalSize / 1024).toFixed(2);
                    const convertedKB = (result.convertedSize / 1024).toFixed(2);
                    const ratio = (((result.originalSize - result.convertedSize) / result.originalSize) * 100).toFixed(1);
                    new Notice(`\u2705 Image converted: ${originalKB}KB \u2192 ${convertedKB}KB (${ratio}% compressed)`);
                } else {
                    // Insert mode - supports multiple files
                    const links: string[] = [];
                    const errors: string[] = [];
                    let totalOriginalSize = 0;
                    let totalConvertedSize = 0;

                    // Show progress for multiple files
                    if (selectedFiles.length > 1) {
                        progressContainer.style.display = "block";
                    }

                    for (let i = 0; i < selectedFiles.length; i++) {
                        const file = selectedFiles[i];

                        // Update progress
                        if (selectedFiles.length > 1) {
                            const pct = ((i) / selectedFiles.length) * 100;
                            progressFill.style.width = `${pct}%`;
                            progressText.textContent = `Converting ${i + 1}/${selectedFiles.length}: ${file.name}`;
                        } else {
                            convertBtn.textContent = "Converting...";
                        }

                        try {
                            const result = await saveImageAndInsert(
                                app,
                                file,
                                currentSettings,
                                settingsPanel.quality,
                                settingsPanel.enableResize,
                                settingsPanel.maxWidth,
                                settingsPanel.maxHeight,
                                settingsPanel.enableGrayscale,
                                settingsPanel.converterType
                            );

                            links.push(`![[${result.path}]]`);
                            totalOriginalSize += result.originalSize;
                            totalConvertedSize += result.convertedSize;
                        } catch (error) {
                            console.error(`Failed to convert ${file.name}:`, error);
                            errors.push(file.name);
                        }
                    }

                    // Complete progress
                    if (selectedFiles.length > 1) {
                        progressFill.style.width = "100%";
                        progressText.textContent = "Done!";
                    }

                    if (links.length > 0) {
                        const markdownLinks = links.join("\n");
                        cleanupAndResolve(markdownLinks);

                        const originalKB = (totalOriginalSize / 1024).toFixed(2);
                        const convertedKB = (totalConvertedSize / 1024).toFixed(2);
                        const ratio = totalOriginalSize > 0
                            ? (((totalOriginalSize - totalConvertedSize) / totalOriginalSize) * 100).toFixed(1)
                            : "0";

                        if (selectedFiles.length === 1) {
                            new Notice(`\u2705 Image converted: ${originalKB}KB \u2192 ${convertedKB}KB (${ratio}% compressed)`);
                        } else {
                            new Notice(`\u2705 ${links.length} images converted: ${originalKB}KB \u2192 ${convertedKB}KB (${ratio}% compressed)`);
                        }

                        if (errors.length > 0) {
                            new Notice(`\u274c Failed to convert: ${errors.join(", ")}`);
                        }
                    } else {
                        new Notice("\u274c All conversions failed");
                        convertBtn.disabled = false;
                        updateConvertButton();
                        progressContainer.style.display = "none";
                    }
                }
            } catch (error) {
                console.error("Image conversion failed:", error);
                new Notice("\u274c Image conversion failed");
                convertBtn.disabled = false;
                updateConvertButton();
                progressContainer.style.display = "none";
            }
        });

        // Initialize with file if provided
        if (initialFile) {
            handleFilesSelect([initialFile]);
            dropZone.showPreview(initialFile);
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
                                handleFilesSelect([file]);
                                dropZone.showPreview(file);
                                new Notice("\u2705 Clipboard image detected");
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
