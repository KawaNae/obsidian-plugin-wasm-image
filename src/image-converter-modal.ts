import { App, Notice } from "obsidian";
import { ConverterSettings } from "./settings";
import { saveImageAndInsert } from "./file-service";

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
    title.textContent = "Image to WebP Converter (WASM)";
    title.style.marginBottom = "15px";
    modal.appendChild(title);

    // ===== Drop Zone =====
    const dropZone = document.createElement("div");
    Object.assign(dropZone.style, {
      border: "2px dashed var(--background-modifier-border)",
      borderRadius: "8px",
      padding: "40px",
      textAlign: "center",
      marginBottom: "15px",
      cursor: "pointer",
      transition: "border-color 0.3s ease",
    });
    dropZone.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 10px;">📷</div>
      <div>Click to select image or drag & drop</div>
      <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">
        Supported: JPG, PNG, GIF, BMP, TIFF
      </div>
    `;
    modal.appendChild(dropZone);

    // ===== Settings =====
    const panel = document.createElement("div");
    panel.style.marginBottom = "15px";

    const qualityLabel = document.createElement("label");
    qualityLabel.textContent = "Quality (0.1 - 1.0): ";
    qualityLabel.style.display = "block";
    qualityLabel.style.marginBottom = "5px";

    const qualityInput = document.createElement("input");
    qualityInput.type = "number";
    qualityInput.min = "0.1";
    qualityInput.max = "1.0";
    qualityInput.step = "0.1";
    qualityInput.value = String(settings.quality);
    qualityInput.style.width = "100px";

    const resizeRow = document.createElement("div");
    resizeRow.style.display = "flex";
    resizeRow.style.alignItems = "center";
    resizeRow.style.marginTop = "10px";
    resizeRow.style.flexWrap = "wrap";
    resizeRow.style.gap = "8px";
    resizeRow.style.fontSize = "14px";

    const resizeCheckbox = document.createElement("input");
    resizeCheckbox.type = "checkbox";
    resizeCheckbox.checked = settings.enableResize;
    resizeCheckbox.id = "enableResize";
    resizeCheckbox.style.marginRight = "8px";

    const resizeText = document.createElement("label");
    resizeText.htmlFor = "enableResize";
    resizeText.textContent = "Resize to max";
    resizeText.style.cursor = "pointer";

    const maxW = document.createElement("input");
    maxW.type = "number";
    maxW.min = "100";
    maxW.max = "5000";
    maxW.value = String(settings.maxWidth);
    maxW.style.width = "70px";
    maxW.style.fontSize = "14px";
    maxW.placeholder = "1920";

    const xLabel = document.createElement("span");
    xLabel.textContent = "×";
    xLabel.style.margin = "0 4px";
    xLabel.style.fontSize = "14px";

    const maxH = document.createElement("input");
    maxH.type = "number";
    maxH.min = "100";
    maxH.max = "5000";
    maxH.value = String(settings.maxHeight);
    maxH.style.width = "70px";
    maxH.style.fontSize = "14px";
    maxH.placeholder = "1080";

    const folderInfo = document.createElement("div");
    folderInfo.style.fontSize = "12px";
    folderInfo.style.color = "var(--text-muted)";
    folderInfo.style.marginTop = "10px";
    folderInfo.textContent = `Save to: ${settings.attachmentFolder}/`;

    resizeRow.appendChild(resizeCheckbox);
    resizeRow.appendChild(resizeText);
    resizeRow.appendChild(maxW);
    resizeRow.appendChild(xLabel);
    resizeRow.appendChild(maxH);

    panel.appendChild(qualityLabel);
    panel.appendChild(qualityInput);
    panel.appendChild(resizeRow);
    panel.appendChild(folderInfo);
    modal.appendChild(panel);

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

    const clipboardBtn = document.createElement("button");
    clipboardBtn.textContent = "📋 Paste from Clipboard";
    clipboardBtn.style.fontSize = "14px";
    clipboardBtn.style.padding = "8px 12px";

    const convertBtn = document.createElement("button");
    convertBtn.textContent = "Convert & Insert";
    convertBtn.disabled = true;
    convertBtn.style.fontSize = "14px";
    convertBtn.style.padding = "8px 12px";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.fontSize = "14px";
    cancelBtn.style.padding = "8px 12px";

    btnRow.appendChild(clipboardBtn);
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
      info.textContent = `Original: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      preview.appendChild(info);
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
        const currentMaxW = parseInt(maxW.value) || settings.maxWidth;
        const currentMaxH = parseInt(maxH.value) || settings.maxHeight;

        const result = await saveImageAndInsert(
          app,
          selectedFile,
          settings,
          quality,
          doResize,
          currentMaxW,
          currentMaxH
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