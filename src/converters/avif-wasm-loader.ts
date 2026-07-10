import { createRemoteWasmLoader } from "./wasm-loader";

// must match @jsquash/avif version in package.json
const AVIF_WASM_VERSION = "2.1.1";
const AVIF_WASM_FILENAME = "avif_enc.wasm";

const loader = createRemoteWasmLoader({
  filename: AVIF_WASM_FILENAME,
  url: `https://unpkg.com/@jsquash/avif@${AVIF_WASM_VERSION}/codec/enc/${AVIF_WASM_FILENAME}`,
  downloadNotice: "Downloading AVIF encoder (~3.5 MB)... This only happens once.",
  readyNotice: "AVIF encoder ready!",
  errorMessage:
    "Failed to download AVIF encoder. Check your internet connection. " +
    "The encoder will be downloaded automatically on next AVIF use.",
});

/**
 * Gets the compiled AVIF encoder WASM module (cached on disk after the
 * first download).
 */
export function getAvifWasmModule(): Promise<WebAssembly.Module> {
  return loader.getModule();
}
