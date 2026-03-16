# CLAUDE.md

## プロジェクト概要

**jupyterlab-myst-revealjs** は、jupyterlab-myst をフロントエンドとして得られた
DOM を、タグやメタデータに基づいて reveal.js に渡す DOM に構築する JupyterLab 拡張。

JupyterLab 上で MyST Markdown ノートブックを reveal.js スライドとして
ライブ表示する。プレゼンテーション中にコードセルを実行し、
結果をその場でスライドに反映できる。


## アーキテクチャ

3つの独立したコンポーネントが連携する。本プロジェクトは中間の「組み立て」を担当する。

```
jupyterlab-myst (yacc相当)  →  本プロジェクト (コード生成器相当)  →  reveal.js (バックエンド相当)
MyST ソース → DOM ノード生成      DOM ノードを <section> に配置         スライドショー表示
```

- **jupyterlab-myst**: セル内容を DOM ノードに変換する。スライドの存在を知らない
- **本プロジェクト**: NotebookModel を読み取り、jupyterlab-myst の出力を
  reveal.js の `<section>` 構造に組み立てる
- **reveal.js**: `<section>` 構造をスライドショーとして表示する。中身を気にしない

すべての操作は DOM レベルで行われる。HTML 文字列への変換は発生しない。

### JupyterLab との統合

DocumentRegistry に SlideshowWidgetFactory を登録し、.ipynb に対する
独立したスライドビューを提供する。ノートブックの DOM に一切触れない。
NotebookPanel と SlideshowPanel は同じ DocumentContext（モデル、カーネル）を共有する。


## 設計原則

1. **原則 0（最上位）: シンプルな実装**。機能制限も辞さない。
2. **原則 1**: コンテンツにレイアウト指示を書かない（MyST ディレクティブは意味的構造のみ）
3. **原則 2**: セルタグの解釈は Jupyter Book に準拠する（独自タグを発明しない）
4. **原則 3**: スライド固有の制御は slideshow メタデータに限定する


## 本プロジェクトの責務

**実装するもの（3つだけ）:**
1. セルメタデータ / タグ → reveal.js スライド構造へのマッピング
2. ノートブック状態とスライドビューの同期
3. Jupyter Book 互換タグのスライドモード内での表示制御

**実装しないもの（既存に委ねる）:**
- コンテンツのレンダリング → jupyterlab-myst（RenderMimeRegistry 経由）
- カーネル管理・セル実行 → JupyterLab
- 静的 HTML エクスポート → Jupyter Book
- スライドナビゲーション・遷移・テーマ → reveal.js


## 技術スタック

- **言語**: TypeScript
- **プロジェクト生成**: copier + JupyterLab extension-template（frontend 種別）
- **JS パッケージマネージャ**: jlpm（JupyterLab 同梱の yarn）
- **Python パッケージマネージャ**: uv
- **ビルド**: @jupyterlab/builder（prebuilt 拡張）
- **テスト**: Jest（単体）、Playwright + Galata（E2E）
- **CI**: GitHub Actions（Linux + Windows）
- **ドキュメント**: Jupyter Book（MyST Markdown）
- **配布**: prebuilt 拡張（pip install でインストール完了、Node.js 不要）


## 依存関係

### npm（package.json）
- `reveal.js` (^6.0.0) — `dependencies`（バンドルに含める。CDN 不使用）
- `@jupyterlab/application`, `@jupyterlab/notebook`, `@jupyterlab/docregistry`,
  `@jupyterlab/rendermime`, `@jupyterlab/apputils`, `@lumino/widgets`
  — `peerDependencies` / `devDependencies`（JupyterLab ランタイムから提供）

### Python（pyproject.toml）
- `jupyterlab` (>=4.0.0) — 必須
- `jupyterlab-myst` — 必須
- `jupyterlab-gridwidth` — optional（`[project.optional-dependencies]` の `gridwidth`）
- `jupyter-book` — optional（`[project.optional-dependencies]` の `docs`）


## 開発コマンド

```bash
# 環境構築
uv venv
uv pip install -e ".[dev]"
jlpm install
jlpm build

# 開発モードリンク
jupyter labextension develop . --overwrite

# JupyterLab 起動
uv run jupyter lab

# TypeScript のウォッチビルド（別ターミナル）
jlpm watch

# テスト
jlpm test              # Jest 単体テスト
cd ui-tests && jlpm test  # Playwright E2E テスト

# ビルド
jlpm build             # TypeScript ビルド
jlpm build:prod        # プロダクションビルド
```


## セルメタデータとタグの仕様

### セルメタデータ（JSON 構造化データ）
- `slideshow.slide_type`: スライド境界定義
  - `"slide"` → 新しい `<section>` を開始
  - `"skip"` → DOM に含めない
  - `"-"` → 前のスライドに属する（明示的な指定なし）
  - MVP 後: `"sub-slide"`, `"fragment"`, `"notes"`

### セルタグ（文字列のリスト）
Jupyter Book 互換:
- `hide-input` → コード入力をトグル付き折りたたみに
- `remove-cell` → セルを DOM に含めない
- MVP 後: `hide-output`, `hide-cell`, `remove-input`, `remove-output`

gridwidth（jupyterlab-gridwidth 互換）:
- `gridwidth-1-2` → 幅 50%
- `gridwidth-1-3` → 幅 33%
- `gridwidth-2-3` → 幅 67%
- CSS クラスを付与するだけ。すべてタグベースで統一的に処理する


## reveal.js DOM 構造

本プロジェクトが構築する DOM:

```html
<div class="reveal">
  <div class="slides">
    <section>
      <!-- slide_type="slide" で開始。セルの DOM ノードを配置 -->
    </section>
    <section>
      <!-- 次の slide_type="slide" で新しいセクション -->
    </section>
  </div>
</div>
```

この DOM を `Reveal.initialize()` に渡すと reveal.js がスライドショーとして表示する。


## MVP 完了基準

以下の 8 項目がすべて動作すること:

1. `slideshow.slide_type` が slide / skip のセルを持つノートブックを開く
2. Ctrl+R（Mac: Option+R）でスライドモードに入る
3. MyST Markdown（figure, admonition, 数式等）がスライド内で正しく表示される
4. コードセルをスライドモード中に実行し、出力がスライドに反映される
5. `hide-input` タグ付きセルのコード入力がトグルで折りたたまれている
6. `remove-cell` タグ付きセルがスライドに表示されない
7. `gridwidth-1-2` タグ等で幅指定されたセルがスライド内で指定幅で表示される
8. ブラウザ F11 でフルスクリーン表示ができる


## 主要コンポーネント（設計予定）

1. **SlideshowWidgetFactory** — DocumentRegistry に登録。.ipynb に対して
   スライドビューを生成する
2. **SlideshowPanel** — DocumentWidget。reveal.js DOM を保持し、
   reveal.js エンジンを初期化・制御する
3. **SlideBuilder** — NotebookModel を読み取り、RenderMimeRegistry 経由で
   セル内容の DOM を取得し、reveal.js の `<section>` 構造に組み立てる


## 注意事項

- reveal.js の CSS は SlideshowPanel の DOM ツリー内にスコープを限定して隔離する
- jupyterlab-gridwidth は JupyterLab 4.2+ の仮想レンダリング（windowingMode: full）と
  非互換だが、本プロジェクトは独自 DocumentWidget なのでこの問題は発生しない
- Windows と WSL2（Linux）の両環境でテストすること。特にシンボリックリンクと
  パス区切り文字の扱いに注意
- RISE ブランドは継承しない。本プロジェクトは新規プロジェクトである


## 詳細ドキュメント

- `docs/requirements.md` — 要求仕様・設計哲学
- `docs/design.md` — 設計ドキュメント（アーキテクチャ、技術スタック、Feasibility 評価）

## 現在の状態

- 開発環境構築完了: copier テンプレート（frontend 種別）でプロジェクト生成済み
- 動作確認済み: JupyterLab 上でテンプレート雛形拡張のロードを確認
- 環境: Python 3.13 + uv + jlpm（JupyterLab 同梱 yarn）
- インストール済み: jupyterlab, jupyterlab-myst, jupyterlab-gridwidth
- 次のステップ: DocumentContext 共有と RenderMimeRegistry 利用方法の確認 → クラス設計
