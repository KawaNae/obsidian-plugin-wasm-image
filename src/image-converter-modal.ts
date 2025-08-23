import { App, Notice } from "obsidian";
import { ConverterSettings, PresetSettings, ConverterType, CONVERTER_OPTIONS } from "./settings";
import { saveImageAndInsert, createProcessingOptions } from "./file-service";
import { sizePredictionService } from "./prediction/size-predictor";

export async function openImageConverterModal(app: App, baseSettings: ConverterSettings): Promise<string | undefined> {
  const settings: ConverterSettings = { ...baseSettings };

  return new Promise((resolve) => {
    // ===== Modal Root =====
    const modal = document.createElement("div");
    Object.assign(modal.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "min(500px, 90vw)",
      maxWidth: "500px",
      maxHeight: "90vh",
      overflowY: "auto",
      background: "var(--background-primary)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "8px",
      padding: "20px",
      zIndex: "9999",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    });

    // タイトル
    const title = document.createElement("h3");
    title.textContent = "WASM Image Converter";
    title.style.marginTop = "0";
    title.style.marginBottom = "15px";
    modal.appendChild(title);

    // ===== Main Content Area =====
    const mainContent = document.createElement("div");
    mainContent.style.display = "flex";
    mainContent.style.gap = "30px";
    mainContent.style.marginBottom = "20px";
    mainContent.style.flexWrap = "nowrap";

    // ===== Left Column - Drop Zone =====
    const leftColumn = document.createElement("div");
    leftColumn.style.flex = "1";
    leftColumn.style.minWidth = "200px";

    const dropZone = document.createElement("div");
    Object.assign(dropZone.style, {
      border: "2px dashed var(--background-modifier-border)",
      borderRadius: "8px",
      padding: "40px",
      textAlign: "center",
      cursor: "pointer",
      transition: "border-color 0.3s ease",
      minHeight: "200px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    });
    dropZone.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 10px;">📷</div>
      <div>Click to select image or drag & drop</div>
      <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">
        Supported: JPG, PNG, GIF, BMP, TIFF
      </div>
    `;

    // Clipboard button for left column
    const clipboardBtn = document.createElement("button");
    clipboardBtn.textContent = "📋 Paste from Clipboard";
    clipboardBtn.style.fontSize = "14px";
    clipboardBtn.style.padding = "8px 12px";
    clipboardBtn.style.marginTop = "10px";
    clipboardBtn.style.width = "100%";

    leftColumn.appendChild(dropZone);
    leftColumn.appendChild(clipboardBtn);

    // ===== Right Column - Settings =====
    const rightColumn = document.createElement("div");
    rightColumn.style.flexShrink = "0";

    // Preset selector row
    const presetRow = document.createElement("div");
    presetRow.style.display = "flex";
    presetRow.style.alignItems = "center";
    presetRow.style.marginBottom = "10px";
    presetRow.style.gap = "10px";

    const presetLabel = document.createElement("label");
    presetLabel.textContent = "Preset:";
    presetLabel.style.fontSize = "14px";
    presetLabel.style.minWidth = "80px";
    presetLabel.style.flexShrink = "0";
    presetLabel.style.color = "var(--text-muted)";

    const presetSelect = document.createElement("select");
    presetSelect.style.width = "120px";
    presetSelect.style.fontSize = "14px";
    presetSelect.style.height = "28px";

    // Converter selector row
    const converterRow = document.createElement("div");
    converterRow.style.display = "flex";
    converterRow.style.alignItems = "center";
    converterRow.style.marginBottom = "10px";
    converterRow.style.gap = "10px";

    const converterLabel = document.createElement("label");
    converterLabel.textContent = "Converter:";
    converterLabel.style.fontSize = "14px";
    converterLabel.style.minWidth = "80px";
    converterLabel.style.flexShrink = "0";
    converterLabel.style.color = "var(--text-muted)";

    const converterSelect = document.createElement("select");
    converterSelect.style.width = "120px";
    converterSelect.style.fontSize = "14px";
    converterSelect.style.height = "28px";

    // Add converter options
    CONVERTER_OPTIONS.forEach(option => {
      const optionEl = document.createElement("option");
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      converterSelect.appendChild(optionEl);
    });
    converterSelect.value = settings.converterType;

    // Add "Default" option
    const defaultOption = document.createElement("option");
    defaultOption.value = "default";
    defaultOption.textContent = "Default";
    presetSelect.appendChild(defaultOption);

    // Add preset options (skip Default preset as it's already added)
    settings.presets.forEach((preset, index) => {
      if (preset.name !== "Default") {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = preset.name;
        presetSelect.appendChild(option);
      }
    });

    // Quality row
    const qualityRow = document.createElement("div");
    qualityRow.style.display = "flex";
    qualityRow.style.alignItems = "center";
    qualityRow.style.marginBottom = "10px";
    qualityRow.style.gap = "10px";

    const qualityLabel = document.createElement("label");
    qualityLabel.textContent = "Quality:";
    qualityLabel.style.fontSize = "14px";
    qualityLabel.style.minWidth = "80px";
    qualityLabel.style.flexShrink = "0";
    qualityLabel.style.color = "var(--text-muted)";

    const qualityInput = document.createElement("input");
    qualityInput.type = "number";
    qualityInput.min = "0.1";
    qualityInput.max = "1.0";
    qualityInput.step = "0.1";
    qualityInput.value = String(settings.quality);
    qualityInput.style.width = "120px";
    qualityInput.style.fontSize = "14px";
    qualityInput.style.height = "28px";
    qualityInput.style.boxSizing = "border-box";

    // Resize checkbox
    const resizeRow = document.createElement("div");
    resizeRow.style.display = "flex";
    resizeRow.style.alignItems = "center";
    resizeRow.style.marginBottom = "10px";
    resizeRow.style.gap = "10px";

    const resizeCheckbox = document.createElement("input");
    resizeCheckbox.type = "checkbox";
    resizeCheckbox.checked = settings.enableResize;
    resizeCheckbox.id = "enableResize";

    const resizeText = document.createElement("label");
    resizeText.htmlFor = "enableResize";
    resizeText.textContent = "Resize";
    resizeText.style.cursor = "pointer";
    resizeText.style.fontSize = "14px";
    resizeText.style.minWidth = "80px";
    resizeText.style.flexShrink = "0";
    resizeText.style.color = "var(--text-muted)";

    const resizeContainer = document.createElement("div");
    resizeContainer.style.width = "120px";
    resizeContainer.style.height = "28px";
    resizeContainer.style.display = "flex";
    resizeContainer.style.alignItems = "center";

    resizeContainer.appendChild(resizeCheckbox);
    resizeRow.appendChild(resizeText);
    resizeRow.appendChild(resizeContainer);

    // Grayscale checkbox
    const grayscaleRow = document.createElement("div");
    grayscaleRow.style.display = "flex";
    grayscaleRow.style.alignItems = "center";
    grayscaleRow.style.marginBottom = "10px";
    grayscaleRow.style.gap = "10px";

    const grayscaleCheckbox = document.createElement("input");
    grayscaleCheckbox.type = "checkbox";
    grayscaleCheckbox.checked = settings.enableGrayscale;
    grayscaleCheckbox.id = "enableGrayscale";

    const grayscaleText = document.createElement("label");
    grayscaleText.htmlFor = "enableGrayscale";
    grayscaleText.textContent = "Grayscale";
    grayscaleText.style.cursor = "pointer";
    grayscaleText.style.fontSize = "14px";
    grayscaleText.style.minWidth = "80px";
    grayscaleText.style.flexShrink = "0";
    grayscaleText.style.color = "var(--text-muted)";

    const grayscaleContainer = document.createElement("div");
    grayscaleContainer.style.width = "120px";
    grayscaleContainer.style.height = "28px";
    grayscaleContainer.style.display = "flex";
    grayscaleContainer.style.alignItems = "center";

    grayscaleContainer.appendChild(grayscaleCheckbox);
    grayscaleRow.appendChild(grayscaleText);
    grayscaleRow.appendChild(grayscaleContainer);

    // Max Width row
    const maxWidthRow = document.createElement("div");
    maxWidthRow.style.display = "flex";
    maxWidthRow.style.alignItems = "center";
    maxWidthRow.style.marginBottom = "10px";
    maxWidthRow.style.gap = "10px";

    const maxWidthLabel = document.createElement("label");
    maxWidthLabel.textContent = "Max Width:";
    maxWidthLabel.style.fontSize = "14px";
    maxWidthLabel.style.minWidth = "80px";
    maxWidthLabel.style.flexShrink = "0";
    maxWidthLabel.style.color = "var(--text-muted)";

    const maxW = document.createElement("input");
    maxW.type = "number";
    maxW.min = "100";
    maxW.max = "5000";
    maxW.value = String(settings.maxWidth);
    maxW.style.width = "120px";
    maxW.style.fontSize = "14px";
    maxW.style.height = "28px";
    maxW.style.boxSizing = "border-box";
    maxW.placeholder = "1920";

    // Max Height row
    const maxHeightRow = document.createElement("div");
    maxHeightRow.style.display = "flex";
    maxHeightRow.style.alignItems = "center";
    maxHeightRow.style.marginBottom = "10px";
    maxHeightRow.style.gap = "10px";

    const maxHeightLabel = document.createElement("label");
    maxHeightLabel.textContent = "Max Height:";
    maxHeightLabel.style.fontSize = "14px";
    maxHeightLabel.style.minWidth = "80px";
    maxHeightLabel.style.flexShrink = "0";
    maxHeightLabel.style.color = "var(--text-muted)";

    const maxH = document.createElement("input");
    maxH.type = "number";
    maxH.min = "100";
    maxH.max = "5000";
    maxH.value = String(settings.maxHeight);
    maxH.style.width = "120px";
    maxH.style.fontSize = "14px";
    maxH.style.height = "28px";
    maxH.style.boxSizing = "border-box";
    maxH.placeholder = "1080";

    // Folder info
    const folderInfo = document.createElement("div");
    folderInfo.style.fontSize = "12px";
    folderInfo.style.color = "var(--text-muted)";
    folderInfo.textContent = `Save to: ${settings.attachmentFolder}/`;

    // Size prediction info
    const predictionInfo = document.createElement("div");
    predictionInfo.style.fontSize = "12px";
    predictionInfo.style.color = "var(--text-accent)";
    predictionInfo.style.marginTop = "5px";
    predictionInfo.style.display = "none"; // Initially hidden
    predictionInfo.textContent = "Select an image to see size prediction";

    // Add elements to their rows
    presetRow.appendChild(presetLabel);
    presetRow.appendChild(presetSelect);
    converterRow.appendChild(converterLabel);
    converterRow.appendChild(converterSelect);
    qualityRow.appendChild(qualityLabel);
    qualityRow.appendChild(qualityInput);
    maxWidthRow.appendChild(maxWidthLabel);
    maxWidthRow.appendChild(maxW);
    maxHeightRow.appendChild(maxHeightLabel);
    maxHeightRow.appendChild(maxH);

    rightColumn.appendChild(presetRow);
    rightColumn.appendChild(converterRow);
    rightColumn.appendChild(qualityRow);
    rightColumn.appendChild(grayscaleRow);
    rightColumn.appendChild(resizeRow);
    rightColumn.appendChild(maxWidthRow);
    rightColumn.appendChild(maxHeightRow);
    rightColumn.appendChild(folderInfo);
    rightColumn.appendChild(predictionInfo);

    mainContent.appendChild(leftColumn);
    mainContent.appendChild(rightColumn);
    modal.appendChild(mainContent);

    // ===== Preview =====
    const preview = document.createElement("div");
    preview.style.marginBottom = "15px";
    modal.appendChild(preview);

    // ===== Buttons =====
    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.flexWrap = "wrap";
    btnRow.style.gap = "8px";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.alignItems = "center";

    const convertBtn = document.createElement("button");
    convertBtn.textContent = "Convert & Insert";
    convertBtn.disabled = true;
    convertBtn.style.fontSize = "14px";
    convertBtn.style.padding = "8px 12px";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.fontSize = "14px";
    cancelBtn.style.padding = "8px 12px";

    btnRow.appendChild(convertBtn);
    btnRow.appendChild(cancelBtn);
    modal.appendChild(btnRow);

    // ===== State =====
    let selectedFile: File | null = null;
    let previewImage: HTMLImageElement | null = null;

    // ===== Helpers =====
    function cleanupAndResolve(val?: string) {
      if (fileInput.parentNode) document.body.removeChild(fileInput);
      modal.remove();
      resolve(val);
    }

    function applyPreset(preset: PresetSettings) {
      converterSelect.value = preset.converterType;
      settings.converterType = preset.converterType;
      qualityInput.value = String(preset.quality);
      maxW.value = String(preset.maxWidth);
      maxH.value = String(preset.maxHeight);
      resizeCheckbox.checked = preset.enableResize;
      grayscaleCheckbox.checked = preset.enableGrayscale;
      settings.attachmentFolder = preset.attachmentFolder;
      folderInfo.textContent = `Save to: ${preset.attachmentFolder}/`;
      updateSizePrediction();
    }

    async function updateFileInfoWithPrediction() {
      if (!selectedFile) {
        // Clear the info in preview
        const info = preview.querySelector('div:last-child') as HTMLDivElement;
        if (info) {
          info.textContent = '';
        }
        return;
      }

      const originalKB = (selectedFile.size / 1024).toFixed(1);
      let infoText = `${selectedFile.name}: ${originalKB}kB`;

      try {
        const quality = parseFloat(qualityInput.value) || settings.quality;
        const doResize = resizeCheckbox.checked;
        const doGrayscale = grayscaleCheckbox.checked;
        const currentMaxW = parseInt(maxW.value) || settings.maxWidth;
        const currentMaxH = parseInt(maxH.value) || settings.maxHeight;
        const converterType = converterSelect.value as ConverterType;

        const predictionResult = await sizePredictionService.predictSize(selectedFile, {
          converterType,
          quality,
          enableGrayscale: doGrayscale,
          enableResize: doResize,
          maxWidth: currentMaxW,
          maxHeight: currentMaxH
        });

        if (predictionResult) {
          const predictedKB = (predictionResult.predictedSize / 1024).toFixed(1);
          const compressionRatio = ((selectedFile.size - predictionResult.predictedSize) / selectedFile.size * 100).toFixed(0);
          
          infoText += ` → <span style="color: var(--text-accent);">Expected: ${predictedKB}kB (-${compressionRatio}%)</span>`;
        }
      } catch (error) {
        console.warn('Size prediction failed:', error);
      }

      // Update the info div in the preview area (below the image)
      const info = preview.querySelector('div:last-child') as HTMLDivElement;
      if (info) {
        info.innerHTML = infoText;
      }
    }

    // Legacy function name for compatibility
    async function updateSizePrediction() {
      await updateFileInfoWithPrediction();
    }

    async function handleFileSelect(file: File) {
      if (!file || !file.type.startsWith("image/")) {
        new Notice("❌ Please select a valid image file");
        return;
      }
      selectedFile = file;
      convertBtn.disabled = false;

      preview.innerHTML = "";
      previewImage = document.createElement("img");
      previewImage.src = URL.createObjectURL(file);
      Object.assign(previewImage.style, {
        maxWidth: "100%",
        maxHeight: "200px",
        objectFit: "contain",
      });
      preview.appendChild(previewImage);

      const info = document.createElement("div");
      info.style.fontSize = "12px";
      info.style.color = "var(--text-muted)";
      info.style.marginTop = "5px";
      preview.appendChild(info);

      // Update file info and size prediction when file is selected
      await updateFileInfoWithPrediction();
    }

    // ===== File input =====
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) handleFileSelect(fileInput.files[0]);
    });

    // ===== Drop events =====
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--interactive-accent)";
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "var(--background-modifier-border)";
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--background-modifier-border)";
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) handleFileSelect(files[0]);
    });

    // ===== Preset Selection =====
    presetSelect.addEventListener("change", () => {
      const selectedValue = presetSelect.value;
      if (selectedValue === "default") {
        const defaultPreset = settings.presets.find(p => p.name === "Default");
        if (defaultPreset) {
          applyPreset(defaultPreset);
        }
      } else {
        const presetIndex = parseInt(selectedValue);
        const selectedPreset = settings.presets[presetIndex];
        if (selectedPreset) {
          applyPreset(selectedPreset);
        }
      }
    });

    // ===== Converter change handler =====
    converterSelect.addEventListener("change", () => {
      settings.converterType = converterSelect.value as ConverterType;
      presetSelect.value = "default";
      updateSizePrediction();
    });

    // ===== Input change handlers to switch to "Default" =====
    const inputElements = [qualityInput, maxW, maxH, resizeCheckbox, grayscaleCheckbox];
    inputElements.forEach(input => {
      input.addEventListener("change", () => {
        presetSelect.value = "default";
        updateSizePrediction();
      });
    });

    // ===== Buttons =====
    clipboardBtn.addEventListener("click", async () => {
      try {
        // Clipboard API（権限が無い場合は Notice のみ）
        const items = await (navigator as any).clipboard.read();
        for (const it of items) {
          for (const t of it.types) {
            if (t.startsWith("image/")) {
              const blob = await it.getType(t);
              const file = new File([blob], `clipboard-${Date.now()}.${t.split("/")[1]}`, { type: t });
              await handleFileSelect(file);
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

    convertBtn.addEventListener("click", async () => {
      if (!selectedFile) return;
      try {
        convertBtn.disabled = true;
        convertBtn.textContent = "Converting...";

        const quality = parseFloat(qualityInput.value);
        const doResize = resizeCheckbox.checked;
        const doGrayscale = grayscaleCheckbox.checked;
        const currentMaxW = parseInt(maxW.value) || settings.maxWidth;
        const currentMaxH = parseInt(maxH.value) || settings.maxHeight;

        const result = await saveImageAndInsert(
          app,
          selectedFile,
          settings,
          quality,
          doResize,
          currentMaxW,
          currentMaxH,
          doGrayscale,
          settings.converterType
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

    // 画面に追加して起動
    document.body.appendChild(modal);

    // 設定に応じて起動時クリップボードチェック
    if (baseSettings.autoReadClipboard) {
      (async () => {
        try {
          const items = await (navigator as any).clipboard.read();
          for (const it of items) {
            for (const t of it.types) {
              if (t.startsWith("image/")) {
                const blob = await it.getType(t);
                const file = new File([blob], `clipboard-${Date.now()}.${t.split("/")[1]}`, { type: t });
                await handleFileSelect(file);
                return;
              }
            }
          }
        } catch {}
      })();
    }
  });
}