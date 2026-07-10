import { App, Notice, requestUrl } from "obsidian";

// must match @jsquash/avif version in package.json
const AVIF_WASM_VERSION = "2.1.1";
const AVIF_WASM_FILENAME = "avif_enc.wasm";
const AVIF_WASM_URL = `https://unpkg.com/@jsquash/avif@${AVIF_WASM_VERSION}/codec/enc/${AVIF_WASM_FILENAME}`;

let appRef: App;
let pluginDirRef: string;
let modulePromise: Promise<WebAssembly.Module> | null = null;

/**
 * Initialize the AVIF WASM loader with app and plugin directory references.
 * Does NOT download the WASM yet — only stores references for later use.
 */
export function initAvifLoader(app: App, pluginDir: string): void {
  appRef = app;
  pluginDirRef = pluginDir;
}

/**
 * Returns whether the AVIF WASM module is already cached on disk.
 */
export async function isAvifWasmAvailable(): Promise<boolean> {
  if (modulePromise) return true;
  if (!appRef || !pluginDirRef) return false;
  return await appRef.vault.adapter.exists(`${pluginDirRef}/${AVIF_WASM_FILENAME}`);
}

/**
 * Get the AVIF WASM module, loading from disk cache or downloading on first use.
 * Throws if download fails and no cached version exists.
 */
export async function getAvifWasmModule(): Promise<WebAssembly.Module> {
  if (!modulePromise) {
    if (!appRef || !pluginDirRef) {
      throw new Error("AVIF loader not initialized. Call initAvifLoader() first.");
    }

    modulePromise = (async () => {
      const wasmPath = `${pluginDirRef}/${AVIF_WASM_FILENAME}`;

      // Try loading from disk cache
      if (await appRef.vault.adapter.exists(wasmPath)) {
        const buffer = await appRef.vault.adapter.readBinary(wasmPath);
        return await WebAssembly.compile(buffer);
      }

      // Download on first use
      new Notice("Downloading AVIF encoder (~3.5 MB)... This only happens once.");

      const response = await requestUrl({ url: AVIF_WASM_URL });
      const buffer = response.arrayBuffer;

      // Save to plugin directory for offline use
      await appRef.vault.adapter.writeBinary(wasmPath, buffer);

      new Notice("AVIF encoder ready!");
      return await WebAssembly.compile(buffer);
    })().catch(e => {
      modulePromise = null;
      console.error("Failed to download AVIF WASM:", e);
      throw new Error(
        "Failed to download AVIF encoder. Check your internet connection. " +
        "The encoder will be downloaded automatically on next AVIF use."
      );
    });
  }
  return modulePromise;
}
