# v1.0 実装 ToDo

## メタデータ仕様

ノートブックメタデータのキーは `myst-revealjs` を使用する。

```json
{
    "myst-revealjs": {
        "theme": "white",
        "transition": "fade",
        "controls": true,
        "progress": true,
        "slideNumber": false,
        "center": true,
        "width": 960,
        "height": 700,
        "scroll": false,
        "header": "",
        "footer": ""
    }
}
```

セル単位のスライドタイプは既存の `slideshow.slide_type` をそのまま使う（nbconvert/RISE 由来の広く使われている規約）。

スライド単位の背景はセルメタデータの `slideshow` 内に追加する:

```json
{
    "slideshow": {
        "slide_type": "slide",
        "slide_background_color": "#1a1a2e",
        "slide_background_image": "url(image.png)",
        "slide_background_size": "cover",
        "slide_background_position": "center",
        "slide_background_repeat": "no-repeat",
        "slide_background_opacity": "0.5"
    }
}
```


## 実装済み

### 設定基盤 + reveal.js オプション + header/footer（2026-03-22）

- `src/settings.ts` 新規作成: `ISlideshowConfig` インターフェース、`readSlideshowConfig()` でメタデータ読み取り + バリデーション、`getThemeCss()` でコア CSS + テーマ CSS を文字列として返す
- `src/content.ts` 変更: コンストラクタで `ISlideshowConfig` を受け取り、テーマ CSS をスコープ内 `<style>` として注入、header/footer オーバーレイ生成、`_initReveal()` で全設定オプション反映
- `src/factory.ts` 変更: `readSlideshowConfig()` で設定読み取り → `SlideshowContent` に渡す
- `src/css.d.ts` 新規作成: `.raw.css` モジュールの型宣言
- `style/themes/*.raw.css`: reveal.js コア CSS + オフライン対応テーマ6種（black, black-contrast, dracula, serif, white, white-contrast）
- `style/base.css` 変更: JupyterLab 色変数を reveal.js テーマ変数にブリッジ、header/footer CSS

デフォルト値: theme=white, transition=slide, controls=true, progress=true, slideNumber=false, center=true, width=960, height=700, scroll=false

同梱テーマはオフライン動作の要件により Google Fonts 依存テーマを除外。オンラインテーマが必要な場合は rise.css で対応。


## Phase 1: 残機能

### Commit 1: スライド単位の背景画像・背景色

**変更ファイル:**
- `src/slidebuilder.ts`

**実装内容:**

1. `_getSlideInfo()` の返り値 `ICellSlideInfo` に `backgroundAttrs: Record<string, string>` を追加する

2. `_getSlideInfo()` で、セルメタデータの `slideshow` オブジェクトから `slide_background_` プレフィックスを持つキーを抽出し、`data-background-` 属性に変換する
   - `slide_background_color` → `data-background-color`
   - `slide_background_image` → `data-background-image`
   - `slide_background_size` → `data-background-size`
   - `slide_background_position` → `data-background-position`
   - `slide_background_repeat` → `data-background-repeat`
   - `slide_background_opacity` → `data-background-opacity`
   - プレフィックスマッチで機械的に変換する（個別の if 文を書かない）

3. `_parseSubSlide()` で、先頭セル（`slide` または `subslide` タイプ）の `backgroundAttrs` を内側の `<section>` 要素に `setAttribute()` で設定する

**手動テスト:**
- テスト用ノートブックのスライドセルに `"slideshow": {"slide_type": "slide", "slide_background_color": "#1a1a2e"}` を設定し、そのスライドの背景色が変わることを確認する


### Commit 2: カスタム CSS 読み込み

**変更ファイル:**
- `src/panel.ts`

**実装内容:**

1. `SlideshowPanel` のコンストラクタ内の `context.ready.then()` ブロックで、スライドビルド後にカスタム CSS の読み込みを試行する

2. CSS ファイルのパスを解決する
   - ノートブックのパスから同じディレクトリの `rise.css` のパスを組み立てる（RISE互換のファイル名）
   - `context.path` からディレクトリ部分を取得し、`rise.css` を結合する

3. JupyterLab の Contents API（`context.sessionContext.session?.kernel` 経由ではなく `ServiceManager` 経由）でファイルの内容を取得する
   - `SlideshowWidgetFactory` で `IDocumentManager` または直接 `ServiceManager.contents` を受け取り、`SlideshowPanel` に渡す
   - もしくは、`SlideshowPanel` から `fetch()` で JupyterLab の Contents API REST エンドポイントにアクセスする方法も検討する
   - いずれの方式でも、ファイルが存在しない場合（404）はサイレントに無視する。エラーでスライドショーを壊さない

4. 取得した CSS テキストを `<style>` 要素として `SlideshowContent` の DOM（`.jp-SlideshowContent` 直下）に注入する

**手動テスト:**
- テスト用ノートブックと同じディレクトリに `rise.css` を作成し、`.reveal section { background: lightyellow; }` 等のルールを書いて、スライドショーに反映されることを確認する
- `rise.css` が存在しない場合にエラーなくスライドショーが表示されることを確認する


## Phase 2: リリース準備

### Commit 3: テスト整備

**変更ファイル:**
- `src/__tests__/jupyterlab_myst_revealjs.spec.ts`（既存ファイルを拡充）

**実装内容:**

SlideBuilder の単体テストを実装する。Jest で NotebookModel をモックし、`buildAll()` が返す DOM 構造を検証する。

テストケース:
- `readSlideshowConfig` がノートブックメタデータから正しく設定を読み取ること
- 不正なテーマ名がデフォルト値にフォールバックすること
- `slide_background_*` メタデータが `data-background-*` 属性に変換されること
- 既存テスト（slide/subslide/fragment/notes/skip、タグ処理）が壊れていないこと


### Commit 4: CI 設定

**新規 / 変更ファイル:**
- `.github/workflows/build.yml`（copier テンプレートに既存なら変更、なければ新規）

**実装内容:**

GitHub Actions ワークフローを設定する:
- トリガー: push（main）、pull request
- マトリクス: ubuntu-latest, windows-latest
- ステップ: checkout → Python セットアップ → Node セットアップ → uv install → jlpm install → jlpm build → jlpm test → jlpm lint:check


### Commit 5: ドキュメント

**新規ファイル:**
- `docs/` 配下に Jupyter Book 用のドキュメントを作成

**実装内容:**

最低限のドキュメント:
- インストール方法（`pip install jupyterlab-myst-revealjs`）
- 基本的な使い方（ツールバーボタンでスライドモードを開く）
- メタデータ設定リファレンス（`myst-revealjs` キーの全オプション）
- セルメタデータリファレンス（`slideshow.slide_type`, `slide_background_*`）
- セルタグリファレンス（hide-input, remove-cell 等）
- テーマ一覧（同梱6種 + カスタムテーマの作り方）
- オフライン動作の方針と、オンラインテーマの利用方法（rise.css）
- RISE からの移行ガイド（メタデータキーの変換方法）


### Commit 6: バージョン v1.0.0 + パッケージメタデータ整備

**変更ファイル:**
- `package.json`（version を `1.0.0` に変更、homepage / repository URL を設定）
- `pyproject.toml`（version を `1.0.0` に変更、classifiers / URLs を設定）
- `LICENSE`（MIT に変更。現在 BSD-3-Clause）

**実装内容:**

- バージョンを `1.0.0` に設定する
- ライセンスを MIT に変更する（requirements.md で決定済み）
- GitHub リポジトリ URL を設定する
- `jlpm build:prod` でプロダクションビルドが成功することを確認する


### Commit 7: GitHub リポジトリ公開

**実装内容（手動作業）:**

- GitHub にリポジトリを作成する
- リモートを設定し push する
- リポジトリの Description、Topics（jupyter, jupyterlab, myst, reveal.js, presentation）を設定する
- README.md を整備する（プロジェクト概要、インストール方法、スクリーンショット）
- CI が通ることを確認する


### Commit 8: PyPI 公開

**新規ファイル:**
- `.github/workflows/publish.yml`

**実装内容（手動作業を含む）:**

1. PyPI で Trusted Publisher を設定する
   - PyPI アカウントで 2FA を有効化する
   - "Add a new pending publisher" で GitHub リポジトリ、ワークフロー名、environment 名を登録する

2. GitHub Actions の publish ワークフローを作成する
   - トリガー: GitHub Release の作成時
   - ステップ: checkout → Python セットアップ → Node セットアップ → ビルド → PyPI に publish（trusted publisher / OIDC 認証）

3. GitHub Release を作成して v1.0.0 を公開する


## v1.0 以降の実装候補（要望次第）

以下は v1.0 には含めない。公開後のフィードバックに応じて優先順位を決定する。

- **Chalkboard**: reveal.js-chalkboard が ESM 非対応のため、グルーコードが必要。プラグイン側の近代化を待つか、フォークが必要
- **スピーカービュー**: reveal.js 組み込みの `window.open()` 方式は UX 問題あり。JupyterLab パネルとして独自実装が望ましい
- **Auto-Animate**: 組み込み機能（`data-auto-animate` 属性付与のみ）。低コスト
- **Lightbox**: 組み込み機能（`data-preview-image` 属性付与のみ）。低コスト
- **セル同期**: スライド遷移 → ノートブックのアクティブセル更新
- **autolaunch**: ノートブック開時に自動スライドショー開始
- **smart exec**: 実行後の次セル自動進行
- **プラグイン API 露出**: ユーザーが任意の reveal.js プラグインを読み込める仕組み
- **.myst.md 直接表示**: MyST Markdown ファイルからの直接スライド表示
