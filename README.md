# WASM Image Converter for Obsidian

A fast, efficient image conversion plugin for Obsidian that converts images to WebP format using WebAssembly (WASM). This plugin works on both desktop and mobile platforms.

## Features

- 🚀 **Fast WebP Conversion**: Uses WebAssembly for high-performance image processing
- 📱 **Cross-Platform**: Works on desktop and mobile Obsidian
- 🎛️ **Customizable Settings**: Adjust quality, resize options, and save location
- 📋 **Clipboard Support**: Paste images directly from clipboard
- 🖱️ **Drag & Drop**: Simple drag and drop interface
- 💾 **Auto-Save**: Automatically saves converted images to your vault

## Installation

### Manual Installation

1. Go to the [Releases page](https://github.com/KawaNae/obsidian-plugin-wasm-image/releases)
2. Download the latest release files:
   - `main.js`
   - `manifest.json`
3. Create a folder named `obsidian-wasm-image` in your vault's `.obsidian/plugins/` directory
4. Place the downloaded files in this folder
5. Reload Obsidian and enable the plugin in Settings → Community plugins

### BRAT Installation (Beta Reviewer's Auto-update Tool)

If you have BRAT installed:
1. Add this repository: `KawaNae/obsidian-plugin-wasm-image`
2. BRAT will automatically download and install the plugin

## Usage

### Basic Usage

1. Open the command palette (`Ctrl+P` or `Cmd+P`)
2. Search for "WASM: Image → WebP Converter"
3. Select an image file or paste from clipboard
4. Adjust conversion settings if needed
5. Click "Convert & Insert" to convert and insert the image link

### Settings

Access plugin settings via Settings → Community plugins → WASM Image Converter

- **Quality** (0.1 - 1.0): Compression quality. Higher values = better quality but larger files
- **Enable resize**: Automatically resize large images
- **Maximum width/height**: Set maximum dimensions for resized images
- **Attachment folder**: Choose where converted WebP files are saved

### Supported Formats

Input formats: JPG, PNG, GIF, BMP, TIFF
Output format: WebP

## Benefits of WebP

- **Smaller file sizes**: 25-35% smaller than JPEG with similar quality
- **Better compression**: Superior lossless and lossy compression
- **Modern format**: Supported by all modern browsers and applications
- **Vault optimization**: Reduces overall vault size

## Development

### Building from Source

```bash
npm install
npm run build
```

### Project Structure

```
src/
├── main.ts                    # Main plugin class
├── settings.ts               # Settings interface and defaults
├── settings-tab.ts          # Settings UI component
├── image-converter.ts       # WASM conversion logic
├── image-converter-modal.ts # Main UI modal
└── file-service.ts         # File operations
```

## Technical Details

- Uses `@jsquash/webp` for WebAssembly-based WebP encoding
- Modular architecture for maintainability
- TypeScript implementation
- Cross-platform compatibility

## License

MIT License

## Contributing

Issues and pull requests are welcome! Please feel free to contribute to improve this plugin.

---

**Note**: This plugin uses WebAssembly for optimal performance. The initial load might take a moment as the WASM module is initialized.
