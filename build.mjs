import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

/**
 * @jsquash/webp 配下の .js/.mjs/.cjs を全部捕まえて、
 *  1) Emscripten の `function(Module = {})` を安全形へ
 *  2) *.wasm 参照を data:URL に強制（import.meta / import_meta 両対応）
 *    - 生成する data: は 'data:application/octet-stream;base64,...' にして
 *      ライブラリ内の isDataURI 判定に確実に引っかかるようにする
 *  3) `new URL(*, import.meta.url)`/`new URL(*, import_meta.url)` を**全部**置換
 */
const fixJsquash = {
  name: "fix-jsquash",
  setup(build) {
    // Windows のバックスラッシュにもマッチするように [/\\] を使用
    const filter = /(?:^|[/\\])node_modules[/\\]@jsquash[/\\].*\.(?:js|mjs|cjs)$/;

    build.onLoad({ filter }, async (args) => {
      let code = await fs.promises.readFile(args.path, "utf8");
      const dir = path.dirname(args.path);

      // (1) Emscripten のデフォルト引数を安全形へ
      code = code
        .replace(
          /function\s*\(\s*Module\s*=\s*\{\}\s*\)\s*\{/g,
          'function(Module){ Module = Module || {};'
        )
        .replace(
          /function\s*\(\s*Module\s*=\s*Module\s*\|\|\s*\{\}\s*\)\s*\{/g,
          'function(Module){ Module = Module || {};'
        );

      // (2) このファイルで参照している wasm 名を拾う（最初の *.wasm）
      const wasmRel =
        code.match(/["']([^"']*webp_enc[^"']*\.wasm)["']/)?.[1] ||
        code.match(/["']([^"']*\.wasm)["']/)?.[1];

      if (wasmRel) {
        const wasmAbs = path.join(dir, wasmRel);
        const wasmBin = await fs.promises.readFile(wasmAbs);
        const dataPrefix = "data:application/octet-stream;base64,";
        const dataUrl = `${dataPrefix}${wasmBin.toString("base64")}`;

        // (3-a) new URL(..., import.meta.url) → new URL("data:...", ) に強制
        //  import.meta でも import_meta でもヒットさせる
        code = code.replace(
          /new\s+URL\s*\(\s*[^,]+,\s*(?:import\.meta|import_meta)\.url\s*\)/g,
          `new URL("${dataUrl}")`
        );

        // (3-b) 念のため、 locateFile 分岐で素の "xxx.wasm" を代入している場合も潰す
        //   wasmBinaryFile = "webp_enc*.wasm";
        code = code.replace(
          /wasmBinaryFile\s*=\s*["'][^"']*\.wasm["']\s*;/g,
          `wasmBinaryFile = "${dataUrl}";`
        );

        console.log(`[inline] ${path.basename(args.path)} -> ${path.basename(wasmAbs)} (inlined)`);
      }

      return { contents: code, loader: "js" };
    });
  },
};

// 出力先ディレクトリ
const outDir = "C:\\Obsidian\\Dev\\.obsidian\\plugins\\obsidian-wasm-image";
const outFile = path.join(outDir, "main.js");

// 出力ディレクトリが存在しない場合は作成
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Created directory: ${outDir}`);
}

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: outFile,
  format: "cjs",
  platform: "browser",
  target: "es2020",
  external: ["obsidian"],
  loader: { ".wasm": "dataurl", ".ts": "ts" }, // 保険
  plugins: [fixJsquash],
  logLevel: "info",
});

console.log(`built: ${outFile}`);

// manifest.json をコピー
const manifestSrc = "manifest.json";
const manifestDest = path.join(outDir, "manifest.json");
fs.copyFileSync(manifestSrc, manifestDest);
console.log(`copied: ${manifestDest}`);
