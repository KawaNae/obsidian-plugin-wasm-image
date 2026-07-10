import { App, Notice, requestUrl } from "obsidian";

let appRef: App | null = null;
let pluginDirRef: string | null = null;

/** Stores app/plugin-dir references used by all remote WASM loaders. */
export function initWasmLoaderContext(app: App, pluginDir: string): void {
  appRef = app;
  pluginDirRef = pluginDir;
}

interface RemoteWasmOptions {
  filename: string;
  url: string;
  downloadNotice: string;
  readyNotice: string;
  errorMessage: string;
}

/**
 * Creates a loader that compiles a WASM binary cached in the plugin
 * directory, downloading it on first use. The plugin directory lives
 * outside the vault index, so adapter access is correct here.
 */
export function createRemoteWasmLoader(opts: RemoteWasmOptions): { getModule(): Promise<WebAssembly.Module> } {
  let modulePromise: Promise<WebAssembly.Module> | null = null;

  return {
    getModule(): Promise<WebAssembly.Module> {
      if (!modulePromise) {
        if (!appRef || !pluginDirRef) {
          throw new Error("WASM loader not initialized. Call initWasmLoaderContext() first.");
        }
        const app = appRef;
        const wasmPath = `${pluginDirRef}/${opts.filename}`;

        modulePromise = (async () => {
          // Try loading from disk cache
          if (await app.vault.adapter.exists(wasmPath)) {
            const buffer = await app.vault.adapter.readBinary(wasmPath);
            return await WebAssembly.compile(buffer);
          }

          // Download on first use
          new Notice(opts.downloadNotice);
          const response = await requestUrl({ url: opts.url });
          const buffer = response.arrayBuffer;

          // Save to plugin directory for offline use
          await app.vault.adapter.writeBinary(wasmPath, buffer);

          new Notice(opts.readyNotice);
          return await WebAssembly.compile(buffer);
        })().catch(e => {
          modulePromise = null;
          console.error(`Failed to load ${opts.filename}:`, e);
          throw new Error(opts.errorMessage);
        });
      }
      return modulePromise;
    }
  };
}
