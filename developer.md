# Developer Guide

## CSS スタイル規則

obsidian-task-viewer のスタイル規則に準拠する。

### BEM 命名規則

```
.block                        /* ブロック: 独立したコンポーネント */
.block__element               /* エレメント: ブロックの構成要素 */
.block--modifier              /* モディファイア: バリエーションや状態 */
.block__element--modifier     /* エレメント + モディファイア */
```

**プレフィックス:** `wasm-image-`

```css
/* 例 */
.wasm-image-drop-zone                   /* ブロック */
.wasm-image-drop-zone__icon             /* エレメント */
.wasm-image-drop-zone--disabled         /* モディファイア */
.wasm-image-settings__nav-btn           /* エレメント */
.wasm-image-settings__nav-btn--active   /* エレメント + モディファイア */
```

### CSS 変数トークン

2層構造で管理する。コンポーネントファイルでは Obsidian 変数を直接使わず、必ず `--wimg-*` トークンを経由する。

**Layer 1: `:root`** — テーマに依存しない定数（サイズ、スペーシング、z-index）

```css
:root {
    --wimg-modal-max-width: 500px;
    --wimg-drop-zone-min-height: 150px;
    --wimg-thumbnail-size: 80px;
}
```

**Layer 2: `body`** — Obsidian テーマ変数から `--wimg-*` トークンへのマッピング

```css
body {
    --wimg-bg-primary: var(--background-primary);
    --wimg-bg-secondary: var(--background-secondary);
    --wimg-text: var(--text-normal);
    --wimg-text-muted: var(--text-muted);
    --wimg-accent: var(--interactive-accent);
    --wimg-border: var(--background-modifier-border);
    --wimg-radius-s: var(--radius-s);
}
```

**トークン命名:**
- `--wimg-bg-*`: 背景色
- `--wimg-text-*`: テキスト色
- `--wimg-border*`: ボーダー色
- `--wimg-radius-*`: 角丸

### ボタン・入力要素の詳細度

Obsidian はグローバルな `button`, `input` スタイルを適用する（詳細度 0,0,1）。プラグインのセレクタはこれに勝つ必要がある。

```css
/* Good — 詳細度 0,2,0、Obsidian のグローバルに勝つ */
.wasm-image-settings .wasm-image-settings__nav-btn { ... }

/* Bad — 詳細度 0,1,1、Obsidian のスタイルと衝突する可能性 */
button.wasm-image-settings__nav-btn { ... }
```

### 状態の表現

```css
/* 疑似クラス（組み込み状態） */
.element:hover { ... }
.element:focus-visible { ... }
.element:disabled { ... }

/* 状態クラス（JS 駆動の状態） */
.wasm-image-drop-zone.drag-over { ... }
.wasm-image-prediction-info.visible { ... }

/* モディファイア（永続的なバリエーション） */
.wasm-image-drop-zone--disabled { ... }
.wasm-image-settings__nav-btn--active { ... }
```

### プロパティの記述順

```css
.element {
    /* Positioning */
    position: relative;
    z-index: 1;

    /* Display & Box Model */
    display: flex;
    padding: 8px;
    margin: 0;

    /* Typography */
    font-size: 14px;
    color: var(--wimg-text);

    /* Visual */
    background-color: var(--wimg-bg-primary);
    border-radius: var(--wimg-radius-s);
    box-shadow: none;

    /* Misc */
    transition: color 0.15s ease;
    cursor: pointer;
    user-select: none;
}
```

### ファイル構成

`src/styles/` にコンポーネント単位で分割する。将来的にファイルを分ける場合は `_` プレフィックスを使う。

```
src/styles/
├── styles.css          # 現在は単一ファイル（将来分割可能）
```

分割する場合の例:
```
src/styles/
├── _variables.css      # CSS トークン定義
├── _modal.css          # モーダルコンポーネント
├── _drop-zone.css      # ドロップゾーン
├── _settings.css       # 設定タブ UI
├── _thumbnail.css      # サムネイルグリッド
└── _progress.css       # プログレスバー
```

### ツールチップ

- `aria-label` を使用する（Obsidian がスタイル付きツールチップとして表示）
- `title` 属性は使わない（ブラウザのネイティブツールチップと重複する）

## ビルド

```bash
npm run dev    # watch モード（開発時）
npm run build  # tsc 型チェック → production ビルド
```

出力先: `$OBSIDIAN_VAULT_PATH/.obsidian/plugins/obsidian-wasm-image/`
デフォルト: `C:\Obsidian\Dev`

## プロジェクト構造

```
src/
├── main.ts                    # プラグインエントリーポイント
├── settings.ts                # 設定型定義・デフォルト値
├── settings-tab.ts            # 設定タブ UI（タブベース）
├── globals.d.ts               # グローバル型宣言 (__BUILD_TIME__)
├── file-service.ts            # ファイル操作サービス
├── converters/                # 画像変換ロジック
│   ├── webp-converter.ts      # WASM WebP 変換
│   ├── canvas-converter.ts    # Canvas API 変換（JPEG/PNG）
│   └── grayscale.ts           # グレースケール変換
├── prediction/                # サイズ予測
│   ├── size-predictor.ts
│   ├── webp-predictor.ts
│   └── canvas-predictor.ts
├── ui/                        # UI コンポーネント
│   ├── image-converter-modal.ts
│   └── components/
│       ├── drop-zone.ts
│       ├── preview-area.ts
│       └── settings-panel.ts
├── utils/
│   └── gif-check.ts
└── styles/
    └── styles.css             # スタイルシート
```
