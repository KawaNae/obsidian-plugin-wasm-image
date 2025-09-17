# WASM Image Converter for Obsidian

Obsidian用の高速画像変換プラグインです。WebAssembly (WASM) をバンドルしているため、オフライン環境下でもデスクトップ・モバイルどちらでも動作します。

## ✨ 主な機能

### 🚀 高速変換
- **WebAssembly技術**: 高性能な画像処理を実現
- **複数フォーマット対応**: JPG、PNG、GIF、BMP、TIFF → WebP
- **クロスプラットフォーム**: 変換機能はデスクトップ・モバイル両対応

### 🎯 自動変換機能 (デスクトップ専用)
- **ドラッグ&ドロップ自動変換**: 画像をエディタにドロップするだけで自動変換
- **ペースト自動変換**: Ctrl+V で画像をペーストして自動変換
- **プリセット選択**: 自動変換時に使用するプリセットを事前に選択可能

### 🎛️ カスタマイズ可能な設定
- **プリセット管理**: 複数の変換設定を保存・切り替え
- **品質調整**: 0.1 - 1.0 の範囲で圧縮品質を設定
- **自動リサイズ**: 大きな画像を指定サイズに自動縮小
- **グレースケール変換**: カラー画像を白黒に変換
- **保存場所指定**: 変換後の画像保存先フォルダを設定

### 📋 便利な入力方法
- **モーダルUI**: 詳細設定を行いながら変換
- **クリップボード対応**: 画像を直接ペースト
- **ファイルサイズ予測**: 変換前にファイルサイズを予測表示

## 📥 インストール方法

### 手動インストール
1. [Releases ページ](https://github.com/KawaNae/obsidian-plugin-wasm-image/releases)にアクセス
2. 最新リリースから以下のファイルをダウンロード:
   - `main.js`
   - `manifest.json`
3. Vaultの `.obsidian/plugins/` フォルダ内に `obsidian-wasm-image` フォルダを作成
4. ダウンロードしたファイルを配置
5. Obsidian を再起動し、設定 → コミュニティプラグインでプラグインを有効化

### BRAT インストール（推奨）
BRAT (Beta Reviewer's Auto-update Tool) をお使いの場合:
1. このリポジトリを追加: `https://github.com/KawaNae/obsidian-plugin-wasm-image`
2. BRAT が自動的にプラグインをダウンロード・インストール

## 🎮 使用方法

### 自動変換
1. 設定 → コミュニティプラグイン → WASM Image Converter → "Auto-convert on drag & drop" をONにして設定を有効化する
2. "Auto-convert preset" で自動変換で使用したいプリセットを選択する
3. 画像ファイルをエディタにドラッグ&ドロップまたは Ctrl+V で画像をペースト
![[2025-09-17 14-04-21.gif]]
### 手動変換
https://github.com/phibr0/obsidian-commander を利用して"WASM Image Converter：Convert Image"コマンドを好きな位置に置くことをお勧めします
1. コマンドパレット (`Ctrl+P` または `Cmd+P`) を開く
2. "WASM Image Converter：Convert Image" を検索・実行
3. パネルに画像をドラッグ&ドロップもしくは"Paste from Clipboard" を押してクリップボードから読み込む
4. 各種変換パラメータを設定する
5. "Convert & Insert" をクリックして変換・挿入
![[2025-09-17 14-03-58.gif]]
## ⚙️ 設定項目

### 全般設定
- **Auto-read clipboard on startup**: 起動時にクリップボードを自動チェック
- **Auto-convert on drag & drop**: ドラッグ&ドロップ時の自動変換機能
- **Auto-convert preset**: 自動変換時に使用するプリセット

### プリセット設定
各プリセットで以下の項目を設定:
- **Converter**: 変換エンジン (現在はWASM WebPのみ)
- **Attachment folder**: 保存先フォルダ
- **Quality**: 圧縮品質 (0.1 - 1.0)
- **Grayscale**: グレースケール変換
- **Resize**: 自動リサイズ機能
- **Maximum width/height**: リサイズ時の最大サイズ

## 🔧 プリセット管理

### デフォルトプリセット
- **Default**: 標準的な設定 (品質: 0.8、リサイズ: 1920x1080)

### カスタムプリセット作成
1. 設定画面で "Make Preset" をクリック
2. プリセット名と各種設定を入力
3. 保存後、自動変換やモーダルで選択可能

### プリセット編集・削除
- **編集**: 各プリセットの "Edit" ボタンをクリック
- **削除**: "Delete" ボタンをクリック (Defaultプリセットは削除不可)

## 📊 WebPのメリット

- **ファイルサイズ**: JPEG比で25-35%小さいファイルサイズ
- **高品質圧縮**: 優れた可逆・非可逆圧縮技術
- **現代的フォーマット**: 全ての主要ブラウザ・アプリケーションで対応
- **Vault最適化**: 全体的なVaultサイズの削減

## 📱 対応プラットフォーム

- **デスクトップ**: Windows、macOS、Linux (全機能対応)
- **モバイル**: iOS、Android (手動変換のみ、自動変換は非対応)

## 🎯 対応形式

**入力形式**: JPG, JPEG, PNG, GIF, BMP, TIFF  
**出力形式**: WebP

## 🔧 開発情報

### ビルド方法
```bash
npm install
npm run build
```

### プロジェクト構造
```
src/
├── main.ts                       # メインプラグインクラス
├── settings.ts                   # 設定インターフェースとデフォルト値
├── settings-tab.ts              # 設定UIコンポーネント
├── image-converter-modal.ts     # メインUI モーダル
├── file-service.ts              # ファイル操作
├── converters/
│   ├── webp-converter.ts        # WebP変換ロジック
│   └── grayscale.ts             # グレースケール変換
└── prediction/
    ├── size-predictor.ts        # ファイルサイズ予測サービス
    └── webp-predictor.ts        # WebP特化予測ロジック
```

### 技術仕様
- **WebAssembly**: `@jsquash/webp` による高速WebPエンコーディング
- **TypeScript**: 型安全な実装
- **モジュラー設計**: 保守性を重視したアーキテクチャ
- **クロスプラットフォーム**: デスクトップ・モバイル対応

## 🐛 トラブルシューティング

### よくある問題
1. **自動変換が動作しない**
   - 設定で "Auto-convert on drag & drop" が有効になっているか確認
   - モバイル版では自動変換は非対応 (手動変換をご利用ください)

2. **変換が失敗する**
   - 対応形式の画像ファイルか確認 (JPG, PNG, GIF, BMP, TIFF)
   - ファイルサイズが大きすぎる場合はリサイズ設定を確認

3. **プリセットが見つからない**
   - "Default" プリセットが存在するか確認
   - プリセットを削除した場合は新しく作成

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

Issues や Pull requests は大歓迎です！プラグインの改善にご協力ください。

---

**注意**: このプラグインは最適なパフォーマンスのためWebAssemblyを使用しています。初回読み込み時はWASMモジュールの初期化に少し時間がかかる場合があります。