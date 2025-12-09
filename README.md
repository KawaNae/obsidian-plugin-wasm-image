# WASM Image Converter for Obsidian

**Languages:** [🇺🇸 English](README.md) | [🇯🇵 日本語](README_ja.md)

A fast, efficient image conversion plugin for Obsidian that converts images to WebP format using WebAssembly (WASM). This plugin works on both desktop and mobile platforms, with built-in WASM bundles for offline functionality.

## ✨ Features

### 🚀 High-Speed Conversion
- **WebAssembly Technology**: High-performance image processing
- **Multiple Format Support**: JPG, PNG, GIF, BMP, TIFF → WebP
- **Cross-Platform**: Conversion functionality works on both desktop and mobile

### 🎯 Auto-Conversion Features (Desktop Only)
- **Drag & Drop Auto-Conversion**: Automatically convert images by simply dropping them into the editor
- **Paste Auto-Conversion**: Automatically convert images pasted with Ctrl+V
- **Preset Selection**: Pre-select presets for use during auto-conversion

### 🎛️ Customizable Settings
- **Preset Management**: Save and switch between multiple conversion settings
- **Quality Adjustment**: Set compression quality from 0.1 to 1.0
- **Auto-Resize**: Automatically downsize large images to specified dimensions
- **Grayscale Conversion**: Convert color images to black and white
- **Save Location**: Configure destination folder for converted images

### 📋 Convenient Input Methods
- **Modal UI**: Convert with detailed settings configuration
- **Clipboard Support**: Paste images directly
- **File Size Prediction**: Preview file size before conversion

## 📥 Installation

### Manual Installation

1. Visit the [Releases page](https://github.com/KawaNae/Obsidian-wasm-image-converter/releases)
2. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
3. Create a folder `obsidian-wasm-image` in your vault's `.obsidian/plugins/` directory
4. Move the downloaded files into that folder
5. Reload Obsidian

### Using BRAT (Beta Reviewers Auto-update Tool)

1. Install [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Open BRAT settings
3. Click "Add Beta plugin"
4. Add this repository: `https://github.com/KawaNae/Obsidian-wasm-image-converter`
2. BRAT will automatically download and install the plugin

## 🎮 Usage

### Auto-Conversion
1. Enable "Auto-convert on drag & drop" in Settings → Community plugins → WASM Image Converter
2. Select your desired preset for auto-conversion in "Auto-convert preset"
3. Drag & drop image files into the editor or paste images with Ctrl+V
![Auto-conversion demo](2025-09-17%2014-04-21.gif)

### Manual Conversion
We recommend using [Obsidian Commander](https://github.com/phibr0/obsidian-commander) to place the "WASM Image Converter: Convert Image" command in your preferred location.

1. Open the command palette (`Ctrl+P` or `Cmd+P`)
2. Search for and execute "WASM Image Converter: Convert Image"
3. Drag & drop images into the panel or click "Paste from Clipboard" to load from clipboard
4. Configure conversion parameters
5. Click "Convert & Insert" to convert and insert
![Manual conversion demo](2025-09-17%2014-03-58.gif)

## ⚙️ Settings

### General Settings
- **Auto-read clipboard on startup**: Automatically check clipboard on startup
- **Auto-convert on drag & drop**: Enable auto-conversion for drag & drop
- **Auto-convert preset**: Preset to use for auto-conversion

### Preset Configuration
Configure the following for each preset:
- **Converter**: Conversion engine (currently WASM WebP only)
- **Attachment folder**: Destination folder
- **Quality**: Compression quality (0.1 - 1.0)
- **Grayscale**: Grayscale conversion
- **Resize**: Auto-resize functionality
- **Maximum width/height**: Maximum size for resizing

## 🔧 Preset Management

### Default Preset
- **Default**: Standard settings (Quality: 0.8, Resize: 1920x1080)

### Creating Custom Presets
1. Click "Make Preset" in the settings screen
2. Enter preset name and various settings
3. After saving, selectable in auto-conversion and modal

### Editing and Deleting Presets
- **Edit**: Click the "Edit" button for each preset
- **Delete**: Click the "Delete" button (Default preset cannot be deleted)

## 📊 Benefits of WebP

- **File Size**: 25-35% smaller than JPEG with similar quality
- **Superior Compression**: Excellent lossless and lossy compression technology
- **Modern Format**: Supported by all major browsers and applications
- **Vault Optimization**: Reduces overall vault size

## 📱 Platform Support

- **Desktop**: Windows, macOS, Linux (full feature support)
- **Mobile**: iOS, Android (manual conversion only, auto-conversion not supported)

## 🎯 Supported Formats

**Input Formats**: JPG, JPEG, PNG, GIF, BMP, TIFF  
**Output Format**: WebP

## 🔧 Development

### Building from Source

```bash
npm install
npm run build
```

### Project Structure

```
src/
├── main.ts                       # Main plugin class
├── settings.ts                   # Settings interface and defaults
├── settings-tab.ts              # Settings UI component
├── image-converter-modal.ts     # Main UI modal
├── file-service.ts              # File operations
├── converters/
│   ├── webp-converter.ts        # WebP conversion logic
│   └── grayscale.ts             # Grayscale conversion
└── prediction/
    ├── size-predictor.ts        # File size prediction service
    └── webp-predictor.ts        # WebP-specific prediction logic
```

### Technical Specifications
- **WebAssembly**: High-speed WebP encoding using `@jsquash/webp`
- **TypeScript**: Type-safe implementation
- **Modular Design**: Architecture focused on maintainability
- **Cross-Platform**: Desktop and mobile support

## 🐛 Troubleshooting

### Common Issues
1. **Auto-conversion not working**
   - Check that "Auto-convert on drag & drop" is enabled in settings
   - Auto-conversion is not supported on mobile (please use manual conversion)

2. **Conversion fails**
   - Verify the image file is in a supported format (JPG, PNG, GIF, BMP, TIFF)
   - If file size is too large, check resize settings

3. **Preset not found**
   - Verify the "Default" preset exists
   - Create a new preset if you've deleted existing ones

## 📄 License

MIT License

## 🤝 Contributing

Issues and pull requests are welcome! Please help us improve this plugin.

---

**Note**: This plugin uses WebAssembly for optimal performance. Initial loading may take a moment as the WASM module initializes.
