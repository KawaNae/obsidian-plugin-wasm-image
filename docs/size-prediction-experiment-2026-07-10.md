# サイズ予測実験: 縮小サンプル実エンコード外挿 (2026-07-10)

## 目的

現行のヒューリスティック予測(係数決め打ち)を「縮小サンプルを実エンコードして外挿する」方式に置き換えられるか、精度・速度・補正式を実測で決める。

## 方法

Dev vault の実画像4枚 + 合成単色1枚に対し、プラグインの実変換パイプライン(リサイズ→エンコード)で
サンプルサイズ 200/400/800px とフルサイズを WebP(q0.8) / AVIF(q0.75) でエンコードし、バイト数と所要時間を計測(計40点)。

対象: photo(実写真 3120x2080)、shot-cal(UIスクショ 2918x3026)、shot-tl(UIスクショ 2108x2712)、illust(イラスト 1006x1221)、solid(単色 1920x1080)

## 主要な発見: 線形外挿は使えない、冪乗則なら使える

素朴なピクセル比外挿(`予測 = サンプルbytes × フル px / サンプル px`)は **+55%〜+380% の系統的過大予測**。
縮小で細部が単位面積に凝縮されるため、bytes/pixel はサンプル側が常に高い。

しかし `bytes ∝ pixels^α` の冪乗則でよく説明できる:

- **WebP: α ≈ 0.71〜0.77**(実画像で安定。α=0.75 を採用)
- **AVIF: α ≈ 0.40〜0.75**(ばらつき大。α=0.65 を採用)

## 精度(サンプル400px、フルサイズ予測)

### WebP (α=0.75)

| 画像 | 実測 | 予測 | 誤差 |
|---|---|---|---|
| photo | 257.6 KB | 284.6 KB | +10% |
| shot-cal | 143.2 KB | 139.2 KB | -3% |
| shot-tl | 108.5 KB | 121.3 KB | +12% |
| illust | 57.3 KB | 50.9 KB | -11% |
| solid | 3.8 KB | 2.6 KB | -32% (絶対1.2KB) |

**実画像で ±12%**。現行ヒューリスティック(2〜5倍外れうる)から大幅改善。

### AVIF (α=0.65)

| 画像 | 実測 | 予測 | 誤差 |
|---|---|---|---|
| photo | 266.8 KB | 215.1 KB | -19% |
| shot-cal | 93.1 KB | 93.1 KB | ±0% |
| shot-tl | 48.3 KB | 87.2 KB | +81% |
| illust | 38.0 KB | 40.2 KB | +6% |
| solid | 0.4 KB | 2.7 KB | (フロア支配、クランプで対処) |

4枚中3枚が ±20%、外れ値1枚(+81%: AVIFがフルサイズのUIスクショを例外的に強く圧縮するケース)。
「目安」表示としては十分実用的。

## 速度(サンプル400px、1回)

- WebP: 15〜63ms — 設定変更のたびに走らせて問題なし
- AVIF: 166〜438ms — 世代ガード(実装済み)+debounce で実用範囲

## 実運用ではさらに精度が上がる見込み

本実験は「フルサイズ出力」への外挿。実際の変換はリサイズ有効時 1920x1080 等に縮むため、
外挿距離(サンプル→ターゲットのピクセル比)が実験の 1/3〜1/4 になり、誤差はさらに縮む。
予測は**リサイズ後のターゲット寸法**に対して外挿すること。

## 推奨実装

```
予測bytes = サンプルbytes × (ターゲットpx / サンプルpx)^α
  WebP: α=0.75 / AVIF: α=0.65
  サンプル: 長辺400px、既存変換関数を enableResize+maxW/H=400 で呼ぶだけ
  下限クランプ: max(予測, フォーマット別ヘッダフロア)
  JPEG/PNG: canvas.toBlob で同方式(未計測、追実験可)
```

## 追加実験: 速度検証と関数的予測の較正 (同日追記)

### CPUスロットリング下のサンプル実エンコード速度 (CDP Emulation.setCPUThrottlingRate、4回中央値付近)

| ケース | 1x | 4x | 6x |
|---|---|---|---|
| WebP s400 / photo 6.5MP | 63ms | ~130ms | ~215ms |
| WebP s400 / shot-cal 8.8MP | 58ms | ~161ms | ~240ms |
| AVIF s400 / photo | 166ms | ~640ms | ~1,120ms |
| AVIF s400 / shot-cal | 438ms | ~1,860ms | ~3,320ms |
| AVIF s200 / photo | 147ms | ~260ms | ~446ms |
| AVIF s200 / shot-cal | 106ms | ~386ms | ~700ms |

計測は元画像のフルデコード+縮小+エンコードを含むエンドツーエンド。
**WebPは6xスロットリング(低速端末相当)でも250ms以下で常時実行可能。AVIFはs400だと6xで3秒超になるためs200を使うべき**(AVIFはαのばらつきが支配的でs200とs400の精度差は小さい)。

### JPEG/PNG (canvas.convertToBlob) の較正データ

- JPEG(q0.8): α≈0.77〜0.82 で安定 → **α=0.8**。サンプルエンコードは6〜58ms(1x)と最速。
- PNG: α=0.51〜0.92 と散らばり、冪乗則の当てはまりは最弱。ただし旧線形式はスクショで**17倍**過大予測しており、冪乗則(α=0.75)+下限 px×0.02 で±40%程度まで改善。

### 関数的予測(ヒューリスティック)の較正結果 → 実装済み

複雑度 c は既存の200pxキャンバス隣接差分平均(photo 0.42 / スクショ 0.06〜0.10 / イラスト 0.11 / 単色 0)。

| フォーマット | 新式 (基準品質で較正) | 実画像での誤差 |
|---|---|---|
| WebP | px^0.75 × 3.0×c^0.42 × (q/0.8)^0.75 | +4〜+20%、イラスト-25% |
| JPEG | px^0.8 × 3.0×c^0.42 × (q/0.8)^0.7 | ±6〜7%、イラスト-18% |
| AVIF | px^0.65 × 18.3×c^0.76 × (q/0.75)^0.8 | ±20%、外れ値+58% |
| PNG | px^0.75 × 302×c^1.7、下限 px×0.02 | ±40%程度 |

旧式は2〜17倍外れることがあった。実機確認: photo→WebP(1920x1080リサイズ)で新式予測 98.3kB、実エンコード外挿による真値 ~96kB(+2%)。

### 推奨アーキテクチャ(サンプル実エンコード予測の実装方針)

1. **二段階表示**: 設定変更時、まず較正済みヒューリスティックを即時表示 → サンプル実エンコード(WebP/JPEG/PNG: 400px、AVIF: 200px)が完了したら置き換え(世代カウンタで整合性は担保済み)
2. **適応フォールバック**: サンプル計測所要が閾値(例800ms)を連続で超えた端末では、そのセッション以降ヒューリスティックのみ表示
3. 外挿は冪乗則 (targetPx/samplePx)^α を使用(αは上表と同じ)

## 生データ

<details><summary>40計測点のJSON</summary>

```json
[{"label":"photo","W":3120,"H":2080,"fmt":"wasm-webp","sample":200,"sw":200,"sh":133,"bytes":5108,"ms":74},{"label":"photo","W":3120,"H":2080,"fmt":"wasm-webp","sample":400,"sw":400,"sh":267,"bytes":13036,"ms":63},{"label":"photo","W":3120,"H":2080,"fmt":"wasm-webp","sample":800,"sw":800,"sh":533,"bytes":34212,"ms":83},{"label":"photo","W":3120,"H":2080,"fmt":"wasm-webp","sample":0,"sw":3120,"sh":2080,"bytes":257626,"ms":516},{"label":"photo","W":3120,"H":2080,"fmt":"wasm-avif","sample":200,"sw":200,"sh":133,"bytes":6181,"ms":147},{"label":"photo","W":3120,"H":2080,"fmt":"wasm-avif","sample":400,"sw":400,"sh":267,"bytes":14896,"ms":166},{"label":"photo","W":3120,"H":2080,"fmt":"wasm-avif","sample":800,"sw":800,"sh":533,"bytes":35000,"ms":361},{"label":"photo","W":3120,"H":2080,"fmt":"wasm-avif","sample":0,"sw":3120,"sh":2080,"bytes":266762,"ms":3326},{"label":"shot-cal","W":2918,"H":3026,"fmt":"wasm-webp","sample":200,"sw":193,"sh":200,"bytes":2212,"ms":51},{"label":"shot-cal","W":2918,"H":3026,"fmt":"wasm-webp","sample":400,"sw":386,"sh":400,"bytes":6696,"ms":58},{"label":"shot-cal","W":2918,"H":3026,"fmt":"wasm-webp","sample":800,"sw":771,"sh":800,"bytes":18668,"ms":86},{"label":"shot-cal","W":2918,"H":3026,"fmt":"wasm-webp","sample":0,"sw":2918,"sh":3026,"bytes":143162,"ms":508},{"label":"shot-cal","W":2918,"H":3026,"fmt":"wasm-avif","sample":200,"sw":193,"sh":200,"bytes":2896,"ms":106},{"label":"shot-cal","W":2918,"H":3026,"fmt":"wasm-avif","sample":400,"sw":386,"sh":400,"bytes":6713,"ms":438},{"label":"shot-cal","W":2918,"H":3026,"fmt":"wasm-avif","sample":800,"sw":771,"sh":800,"bytes":16991,"ms":1023},{"label":"shot-cal","W":2918,"H":3026,"fmt":"wasm-avif","sample":0,"sw":2918,"sh":3026,"bytes":93132,"ms":2489},{"label":"shot-tl","W":2108,"H":2712,"fmt":"wasm-webp","sample":200,"sw":155,"sh":200,"bytes":2710,"ms":32},{"label":"shot-tl","W":2108,"H":2712,"fmt":"wasm-webp","sample":400,"sw":311,"sh":400,"bytes":6868,"ms":37},{"label":"shot-tl","W":2108,"H":2712,"fmt":"wasm-webp","sample":800,"sw":622,"sh":800,"bytes":20688,"ms":62},{"label":"shot-tl","W":2108,"H":2712,"fmt":"wasm-webp","sample":0,"sw":2108,"sh":2712,"bytes":108464,"ms":313},{"label":"shot-tl","W":2108,"H":2712,"fmt":"wasm-avif","sample":200,"sw":155,"sh":200,"bytes":3279,"ms":53},{"label":"shot-tl","W":2108,"H":2712,"fmt":"wasm-avif","sample":400,"sw":311,"sh":400,"bytes":7244,"ms":288},{"label":"shot-tl","W":2108,"H":2712,"fmt":"wasm-avif","sample":800,"sw":622,"sh":800,"bytes":18303,"ms":940},{"label":"shot-tl","W":2108,"H":2712,"fmt":"wasm-avif","sample":0,"sw":2108,"sh":2712,"bytes":48267,"ms":9505},{"label":"illust","W":1006,"H":1221,"fmt":"wasm-webp","sample":200,"sw":165,"sh":200,"bytes":3136,"ms":14},{"label":"illust","W":1006,"H":1221,"fmt":"wasm-webp","sample":400,"sw":330,"sh":400,"bytes":9552,"ms":20},{"label":"illust","W":1006,"H":1221,"fmt":"wasm-webp","sample":800,"sw":659,"sh":800,"bytes":28772,"ms":39},{"label":"illust","W":1006,"H":1221,"fmt":"wasm-webp","sample":0,"sw":1006,"sh":1221,"bytes":57318,"ms":74},{"label":"illust","W":1006,"H":1221,"fmt":"wasm-avif","sample":200,"sw":165,"sh":200,"bytes":3548,"ms":88},{"label":"illust","W":1006,"H":1221,"fmt":"wasm-avif","sample":400,"sw":330,"sh":400,"bytes":9434,"ms":286},{"label":"illust","W":1006,"H":1221,"fmt":"wasm-avif","sample":800,"sw":659,"sh":800,"bytes":25807,"ms":925},{"label":"illust","W":1006,"H":1221,"fmt":"wasm-avif","sample":0,"sw":1006,"sh":1221,"bytes":38027,"ms":2033},{"label":"solid","W":1920,"H":1080,"fmt":"wasm-webp","sample":200,"sw":200,"sh":113,"bytes":122,"ms":11},{"label":"solid","W":1920,"H":1080,"fmt":"wasm-webp","sample":400,"sw":400,"sh":225,"bytes":246,"ms":15},{"label":"solid","W":1920,"H":1080,"fmt":"wasm-webp","sample":800,"sw":800,"sh":450,"bytes":736,"ms":24},{"label":"solid","W":1920,"H":1080,"fmt":"wasm-webp","sample":0,"sw":1920,"sh":1080,"bytes":3790,"ms":80},{"label":"solid","W":1920,"H":1080,"fmt":"wasm-avif","sample":200,"sw":200,"sh":113,"bytes":329,"ms":17},{"label":"solid","W":1920,"H":1080,"fmt":"wasm-avif","sample":400,"sw":400,"sh":225,"bytes":355,"ms":24},{"label":"solid","W":1920,"H":1080,"fmt":"wasm-avif","sample":800,"sw":800,"sh":450,"bytes":736,"ms":52},{"label":"solid","W":1920,"H":1080,"fmt":"wasm-avif","sample":0,"sw":1920,"sh":1080,"bytes":367,"ms":244}]
```

</details>
