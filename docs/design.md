# jupyterlab-myst-revealjs: 設計ドキュメント

---

要求仕様（requirements-and-design-philosophy.md）の分析と
歴史的教訓の検討を経て、本プロジェクトのアーキテクチャは以下に帰着した:

**jupyterlab-myst をフロントエンドとして得られた DOM を、
タグやメタデータに基づいて reveal.js に渡す DOM に構築する JupyterLab 拡張。**

本ドキュメントでは、この結論に至った過程と具体的な設計を記述する。


## 1. アーキテクチャの選択

### 1.1 歴史的教訓

#### 第1世代: RISE（classic notebook 用）

ノートブックのセルをその場で reveal.js のスライドに変形するアプローチ。
classic notebook は DOM 構造がシンプルだったため機能したが、
JupyterLab には移植できなかった。

#### 第2世代: jupyterlab-rise

JupyterLab の DOM を直接変形しようとしたが、
仮想レンダリング（画面外のセルを描画しない最適化）や
見出し折りたたみ等、JupyterLab 固有の機能と衝突した。
結果として `/rise/` という別 URL のスタンドアロンアプリ方式を採用したが、
JupyterLab 4.x でルーティングの問題（404 エラー）を引き起こし、
サーバーサイド拡張も必要になり、保守コストが増大した。

#### 2つの教訓

**教訓 1: JupyterLab の DOM を直接変形するのは危険。**
JupyterLab は仮想レンダリング、見出し折りたたみ、各種拡張による DOM 操作など、
多くの暗黙の前提を持つ。これらを一つずつ無効化していくアプローチは、
JupyterLab のバージョンアップのたびに壊れるリスクが高い。

**教訓 2: 別 URL / 別アプリ方式は JupyterLab のライフサイクルと相性が悪い。**
サーバーサイドのルーティング、アプリの初期化、カーネル接続の確立を
独立して管理する必要があり、複雑さが爆発する。


### 1.2 選択したアプローチ: DocumentRegistry WidgetFactory

**JupyterLab の DocumentRegistry に .ipynb 用の新しい WidgetFactory を登録し、
同じノートブックに対して「スライドビュー」という独立したビューを提供する。**

JupyterLab は同じファイルに対して複数のビューを開く仕組みを
DocumentRegistry として持っている。WidgetFactory は DocumentWidget を生成し、
DocumentWidget は context（モデル、カーネル、ファイル I/O）と
content（表示）を分離する。

このアプローチは:
- 教訓 1 を回避: 既存のノートブック DOM に一切触れない
- 教訓 2 を回避: JupyterLab のパネルシステム内で動作し、サーバーサイド拡張は不要
- ビューレイヤー原則に合致: context がモデルとカーネルを管理し、
  WidgetFactory が表示のみを担う
- カーネル共有が自動的: 同じ context なので同じカーネルが使われる
- CSS 競合が構造的に解消: 独立した DOM ツリーなので reveal.js の CSS は
  基本的に閉じ込められる（グローバルセレクタへの対応は §3.9 参照）


### 1.3 アーキテクチャの構造: コンパイラのアナロジー

本プロジェクトのアーキテクチャは、コンパイラの設計と類似する。

gcc はバイナリ生成のために独自の中間表現を使い、
フロントエンドとバックエンドが特殊化してしまったため拡張性が失われた。
一方、clang/LLVM は中間表現（LLVM IR）をしっかり定義したことで、
フロントエンドとバックエンドを切り分けて自由に組み合わせられるようになった。

本プロジェクトに当てはめると:

```
[フロントエンド]                    [中間表現]         [バックエンド]

Notebook Model                                      
  │                                                  
  ├─ セル構造解釈 ──────┐                             
  │  (本プロジェクト)    │                             
  │                     │                             
  ├─ Markdown レンダリング ─┤→ reveal.js DOM  →  reveal.js エンジン
  │  (jupyterlab-myst    │   (<section> 構造)    (ナビゲーション、
  │   に委譲)            │                        遷移、テーマ、
  │                     │                        プラグイン)
  ├─ 出力レンダリング ───┘                             
  │  (JupyterLab                                     
  │   RenderMimeRegistry)                            
  │                                                  
  └─ タグ・メタデータ処理                              
     (本プロジェクト)                                  
```

コンパイラのフロントエンドが字句解析→構文解析→意味解析と
複数の中間表現を経由するように、本プロジェクトのフロントエンドも
既存のレンダラー（jupyterlab-myst, RenderMimeRegistry）を
中間段階として再利用し、最終的に reveal.js DOM を構築する。

**フロントエンド（多段構成）:**
- **jupyterlab-myst に委譲（yacc 相当）**: MyST ソース → DOM ノード
- **JupyterLab に委譲**: Code セルの出力 → DOM ノード（RenderMimeRegistry 経由）
- **本プロジェクトが担当（コード生成器相当）**: DOM ノードを `<section>` 構造に組み立てる

各レンダラーの役割と関係の詳細は §2.4 を参照。

再利用できるものはできるだけ再利用し、
本プロジェクトの独自実装をセル構造の解釈と DOM 構築に限定する。
セルの配置・レイアウトは CSS で自由に制御でき、
通常のスライド用途では十分な表現力を持つ（§2.5 参照）。

**中間表現（reveal.js DOM）:**
reveal.js が定義するスライド構造。
`<div class="reveal"><div class="slides"><section>...</section></div></div>`
この仕様は安定しており、well-defined である。

**バックエンド（reveal.js が提供）:**
構築された DOM に対して、ナビゲーション、遷移エフェクト、テーマ適用、
プラグイン（chalkboard 等）を適用する。
本プロジェクトはこの部分に一切手を入れない。

### 1.4 このアーキテクチャの利点

**自由度**: DOM の組み立て（セル構造の解釈とタグ処理）を独自実装するため、
ノートブックモデルからスライド構造への変換を完全に制御できる。
hide-input の表示制御も、gridwidth のレイアウトも、
すべて組み立てロジックとして実装できる。

**安定性**: reveal.js の DOM 仕様は安定しているため、
フロントエンドの変換ロジックが reveal.js のバージョンアップで壊れにくい。

**テスト容易性**: フロントエンドの出力（reveal.js DOM）は検査可能。
「このメタデータを持つノートブックから、この DOM が生成されるべき」
というテストが書ける。

**デカップリング**: フロントエンドとバックエンドが中間表現で分離されているため、
将来的に reveal.js 以外のプレゼンテーションエンジンに置き換えることも
理論上は可能（ただし当面は reveal.js 固定）。


## 2. コンポーネント構成

### 2.1 全体像

ユーザーが Ctrl+R または「Open With > Slideshow」でスライドビューを開くと、
JupyterLab の DocumentRegistry に登録された SlideshowWidgetFactory が
SlideshowPanel を生成する。この SlideshowPanel は、
既に開かれているノートブックと同じ DocumentContext を共有するため、
同じカーネルとモデルにアクセスできる。

```
┌──────────────────────────────────────────────────────┐
│ JupyterLab                                          │
│                                                      │
│  DocumentRegistry                                    │
│  ├── NotebookWidgetFactory（既存）                    │
│  └── SlideshowWidgetFactory（本プロジェクト）         │
│                                                      │
│  ┌──────────────┐    ┌─────────────────────┐         │
│  │ NotebookPanel│    │ SlideshowPanel      │         │
│  │ (既存)       │    │ (本プロジェクト)     │         │
│  │              │    │                     │         │
│  │ ノートブック  │    │ reveal.js DOM       │         │
│  │ ビュー       │    │ スライドビュー       │         │
│  └──────┬───────┘    └────────┬────────────┘         │
│         │                     │                      │
│         └─────────┬───────────┘                      │
│                   │                                  │
│          ┌────────┴────────┐                         │
│          │ DocumentContext │                         │
│          │ (共有)          │                         │
│          │ - NotebookModel │                         │
│          │ - SessionContext │                         │
│          │ - Kernel        │                         │
│          └─────────────────┘                         │
└──────────────────────────────────────────────────────┘
```

NotebookPanel と SlideshowPanel は完全に独立した DOM ツリーを持つ。
ノートブックの DOM に手を加えることは一切ない。

### 2.2 フロントエンド: Notebook → reveal.js DOM 変換

フロントエンドが行う変換の概要:

1. **NotebookModel からセル一覧を取得**
2. **各セルの slideshow.slide_type メタデータを読み取り、
   スライド境界を決定**
   - slide → 新しい `<section>` を開始
   - skip → スキップ（DOM に含めない）
   - （MVP 後: sub-slide, fragment, notes）
3. **各セルのタグを読み取り、表示制御を適用**
   - hide-input → コード入力部分をトグル付き折りたたみに
   - remove-cell → DOM に含めない
   - gridwidth-1-2, gridwidth-1-3 等 → CSS 幅クラスを付与
   （すべてタグベースなので統一的に処理できる）
4. **各セルの内容を `<section>` 内に配置**
   - Markdown セル → RenderMimeRegistry 経由で DOM ノードを取得
   - Code セル → 入力（コード）の DOM + RenderMimeRegistry 経由で出力の DOM ノードを取得
   （RenderMimeRegistry は JupyterLab がセル内容をレンダリングする共通基盤。
   jupyterlab-myst は Markdown 用のレンダラーをここに登録しており、
   本プロジェクトはこのレジストリを経由することで jupyterlab-myst の
   レンダリング結果を HTML 文字列ではなく DOM ノードとして受け取る）
5. **reveal.js の初期化構造で全体を包む**

### 2.3 用語の整理: DOM と HTML

本ドキュメントでは「DOM」と「HTML」を以下の意味で使い分ける。

- **DOM（Document Object Model）**: ブラウザのメモリ上に存在するツリー構造。
  ノード（要素、テキスト等）の親子関係で構成される。
  JavaScript からプログラム的に操作できる。
- **HTML**: DOM のシリアライズ形式の一つ。テキストとして表現される。
  ブラウザが HTML をパースすると DOM ツリーが構築される。

HTML ⊆ DOM の関係にある。HTML は DOM を文字列として記述したものであり、
ブラウザの中ではすべて DOM として扱われる。

jupyterlab-myst が返すのは DOM ノード（Lumino Widget として包まれている）であり、
HTML 文字列ではない。本プロジェクトはこの DOM ノードを受け取り、
reveal.js が要求する DOM 構造（`<section>` のツリー）に組み込む。
すべての操作は DOM レベルで行われ、HTML 文字列への変換は発生しない。

### 2.4 jupyterlab-myst と reveal.js の役割の違い

jupyterlab-myst と reveal.js はともにレンダラーだが、
**異なるレベルで動作し、互いの存在を知らない。**
本プロジェクトが間に立って両者を橋渡しする。

#### jupyterlab-myst: セル内容のレンダリング（コンテンツレベル）

MyST Markdown のソーステキストを受け取り、DOM ノードを生成する。

```
入力（MyST テキスト）:             出力（DOM ノード）:

```{note}                         <div class="admonition note">
重要な注意点です                     <p class="admonition-title">Note</p>
```                                  <p>重要な注意点です</p>
                                   </div>
```

jupyterlab-myst はスライドの存在を一切知らない。
「この MyST テキストを DOM にしてくれ」という要求に応えるだけである。
ノートブックビューでも、スライドビューでも、同じ DOM ノードを返す。
コンパイラのアナロジーでは **yacc（構文解析器）** に相当する。

#### reveal.js: スライド表示のレンダリング（プレゼンテーションレベル）

特定の DOM 構造（`<section>` の並び）を受け取り、スライドショーとして表示する:

- `<section>` をスライドとして認識し、1つずつ表示する
- キーボード / マウスによるナビゲーション
- スライド遷移のアニメーション
- テーマ（フォント、色、背景）の適用

reveal.js は `<section>` の中身が何であるかを一切気にしない。
中に admonition があろうが、matplotlib のグラフがあろうが、同じように扱う。
コンパイラのアナロジーでは **バックエンド（コード生成 + 最適化）** に相当する。

#### 本プロジェクト: 両者の橋渡し（組み立て）

```
[jupyterlab-myst]        [本プロジェクト]          [reveal.js]
(yacc 相当)              (コード生成器相当)        (バックエンド相当)

MyST ソース              セル内容の DOM ノード      <section> 構造
    │                         │                        │
    ↓                         ↓                        ↓
 DOM ノード生成  →  <section> 内に配置  →  スライドショー表示
```

処理の流れ:

1. **本プロジェクト**が NotebookModel からセル一覧を取得する
2. 各セルについて、RenderMimeRegistry 経由で
   **jupyterlab-myst** にレンダリングを依頼する
   → jupyterlab-myst が DOM ノードを返す
   （jupyterlab-myst はこの DOM がスライドに使われるとは知らない）
3. **本プロジェクト**が slideshow メタデータとタグを読み取り、
   返ってきた DOM ノードを `<section>` の中に配置する
   **（ここが本プロジェクトの主な仕事）**
4. 完成した `<section>` 構造を **reveal.js** に渡す
   → reveal.js がスライドショーとして表示する
   （reveal.js は `<section>` の中身が MyST 由来とは知らない）

#### 具体例

以下のノートブックがあるとする:

```
セル 0 (Markdown): slideshow.slide_type = "slide"
  # タイトル
  本日の内容を説明します

セル 1 (Code):     slideshow.slide_type = "-" (前のスライドに属する)
  tags: ["hide-input"]
  plt.plot([1,2,3])
  → 出力: グラフ画像

セル 2 (Markdown): slideshow.slide_type = "slide"
  tags: ["gridwidth-1-2"]
  ```{figure} image.png
  実験結果
  ```

セル 3 (Code):     slideshow.slide_type = "skip"
  # ヘルパー関数（スライドに表示しない）
```

本プロジェクトが構築する reveal.js DOM:

```
<div class="reveal">
  <div class="slides">

    <section>  ← セル0の slide_type="slide" で開始

      [セル0の DOM ノード]  ← jupyterlab-myst が生成
        <h1>タイトル</h1>
        <p>本日の内容を説明します</p>

      [セル1の DOM ノード]  ← 本プロジェクトが hide-input 構造を構築
        <details>                 + RenderMimeRegistry が出力をレンダリング
          <summary>コードを表示</summary>
          <pre>plt.plot([1,2,3])</pre>
        </details>
        <img src="..." />   ← matplotlib グラフ（JupyterLab 標準レンダラー）

    </section>

    <section>  ← セル2の slide_type="slide" で新しいスライド開始

      [セル2の DOM ノード]  ← class="gridwidth-1-2" を本プロジェクトが付与
        <figure>                  + jupyterlab-myst が figure をレンダリング
          <img src="image.png" />
          <figcaption>実験結果</figcaption>
        </figure>

    </section>

    <!-- セル3: skip なので DOM に含めない -->

  </div>
</div>
```

この DOM 全体を `Reveal.initialize()` に渡すと、
reveal.js がスライドショーとして表示する。

### 2.5 MyST レンダリングの取り扱い

#### 調査結果

MyST のレンダリングパイプラインには複数のレイヤーが存在する:

- **mystjs (npm)**: `new MyST().render(source)` でシンプルに HTML を生成できる。
  ただし、jupyterlab-myst のリッチな機能（cross-reference, frontmatter, eval 等）は含まれない。
- **myst-to-react**: MyST AST を React コンポーネントに変換する。
  jupyterlab-myst はこれを使用している。
- **JupyterLab RenderMimeRegistry**: JupyterLab の出力レンダリング基盤。
  各 MIME タイプ（text/markdown, image/png, text/html 等）に対する
  レンダラーが登録されており、セル内容や出力をレンダリングする際に使われる。
  jupyterlab-myst はここに MyST 対応の Markdown レンダラーを登録している。
  レンダリング結果は HTML 文字列ではなく Lumino Widget（DOM ノードを含む）として返される。

#### 設計判断: RenderMimeRegistry 経由で jupyterlab-myst を利用する

§2.4 で述べた通り、jupyterlab-myst は独立したコンポーネント（yacc 相当）として
セル内容の DOM ノードを生成し、本プロジェクトはその結果を受け取って
reveal.js DOM に組み立てる。
この受け渡しは JupyterLab の RenderMimeRegistry を経由して行われる。

この方式の利点:
- jupyterlab-myst のレンダリングをそのまま再利用でき、再実装は一切不要
- Markdown セルと Code セルの出力が RenderMimeRegistry で統一的に扱える
- jupyterlab-myst がバージョンアップしても、本プロジェクトは自動的に恩恵を受ける

#### 再利用の範囲と限界

RenderMimeRegistry に委譲するのは**セルの中身のレンダリング**であり、
**セルの配置・レイアウト**は本プロジェクトが完全に制御する。

```
本プロジェクトが CSS で自由に制御できる部分:
├── <section>（スライド全体のスタイル）
├── セル間のレイアウト（並び順、幅、gridwidth）
├── hide-input の折りたたみ構造
├── 垂直センタリング、余白、フォントサイズ
└── 背景画像・背景色

RenderMimeRegistry に委譲する部分（容器の中身）:
├── Markdown の中身（admonition, figure, 数式等の内部構造）
└── Code 出力の中身（画像、テキスト、ウィジェット）
```

通常のスライド用途では、セルの配置とスタイリングが CSS で
制御できれば十分であり、容器の中身を変更する必要はない。
むしろ、jupyterlab-myst のレンダリング結果がそのまま表示されることが
Jupyter Book との一貫性の点で望ましい。

この方式の限界が生じるのは、PowerPoint や Beamer のように
独自のレンダリングエンジンを持つレベルの機能を求める場合である。
例えば、admonition の内部構造をスライド用に組み替えたり、
figure のキャプション位置をスライドごとに変えたりするような、
コンテンツの中身の構造レベルの制御が必要な場合には、
RenderMimeRegistry への委譲では対応できない。
ただし、本プロジェクトはそのようなスライドツールを目指していない。


## 3. 技術スタック

### 3.1 選定方針

原則 0（シンプルさ）に基づき、JupyterLab 公式が推奨するツールチェインに
可能な限り従う。独自のビルドシステムやフレームワークは導入しない。

### 3.2 プロジェクト生成

**copier ベースの JupyterLab extension-template** を使用する。

```bash
copier copy --trust https://github.com/jupyterlab/extension-template .
```

- cookiecutter は非推奨（deprecated）、copier が後継
- 拡張の種類: **frontend**（サーバーサイド拡張は不要）
- テスト設定: 有効
- Binder 設定: 有効（デモ環境の提供用）

生成されるプロジェクト構造:
```
jupyterlab-myst-revealjs/
├── src/                    # TypeScript ソース
│   └── index.ts            # プラグインのエントリポイント
├── style/                  # CSS
├── jupyterlab_myst_revealjs/  # Python パッケージ（配布用）
├── ui-tests/               # Playwright/Galata テスト
├── package.json            # npm パッケージ定義
├── tsconfig.json           # TypeScript 設定
├── pyproject.toml          # Python パッケージ設定
└── ...
```

### 3.3 言語とランタイム

| 項目 | 選定 | 根拠 |
|---|---|---|
| **言語** | TypeScript | JupyterLab 拡張の標準言語 |
| **TypeScript バージョン** | copier テンプレートが指定するバージョンに従う | JupyterLab との互換性を保証 |
| **JS パッケージマネージャ** | jlpm（JupyterLab 同梱の yarn） | JupyterLab 開発の標準ツール |
| **Python パッケージマネージャ** | uv | 高速な依存解決、lockfile によるビルド再現性 |
| **ビルドツール** | @jupyterlab/builder | prebuilt 拡張のビルドに必要 |

#### uv の採用理由

- pip/venv の代替として高速（10〜100倍）な依存解決とインストール
- `uv.lock` による再現可能なビルド環境
- `pyproject.toml` ベースのプロジェクト管理（copier テンプレートと整合）
- Python バージョン管理も統合されており、pyenv 等の別ツールが不要

開発者は uv を使用し、エンドユーザーは従来通り pip でインストールできる
（pyproject.toml から生成される wheel は pip 互換）。

#### 開発環境の構築手順（想定）

```bash
# リポジトリのクローン
git clone https://github.com/<user>/jupyterlab-myst-revealjs.git
cd jupyterlab-myst-revealjs

# Python 環境の構築（uv）
uv venv
uv pip install -e ".[dev]"

# JS 依存のインストールとビルド（jlpm）
jlpm install
jlpm build

# 開発モードで JupyterLab にリンク
jupyter labextension develop . --overwrite

# JupyterLab 起動
uv run jupyter lab
```

### 3.4 ターゲット環境

| 項目 | 選定 | 根拠 |
|---|---|---|
| **JupyterLab** | ≥ 4.0.0 | DocumentRegistry WidgetFactory が安定している |
| **Python** | ≥ 3.9 | JupyterLab 4.x の最小要件に合わせる |
| **Node.js** | ≥ 18 | 開発時のみ必要（ユーザーは不要） |
| **ブラウザ** | Chrome, Firefox, Safari, Edge（最新版） | reveal.js のサポート範囲に準拠 |
| **開発 OS** | Windows + WSL2（Linux） | 両環境で開発・テストし、クロスプラットフォーム問題を早期発見する |

普段の開発はどちらか一方で行い、もう片方で定期的に動作確認する。
特にシンボリックリンク（`jupyter labextension develop` が使用）や
パス区切り文字の扱いは OS 間で差異が出やすいため、
両環境でのテストにより問題を早期に検出できる。

### 3.5 主要依存パッケージ

#### npm 依存（package.json）

| パッケージ | 用途 | バンドル方式 |
|---|---|---|
| **reveal.js** (^6.0.0) | スライドエンジン | @jupyterlab/builder がバンドルに含める |
| **@jupyterlab/application** | JupyterLab アプリケーション API | JupyterLab が提供（外部依存） |
| **@jupyterlab/notebook** | ノートブック API（NotebookPanel, INotebookModel） | JupyterLab が提供（外部依存） |
| **@jupyterlab/docregistry** | DocumentRegistry API（WidgetFactory） | JupyterLab が提供（外部依存） |
| **@jupyterlab/rendermime** | RenderMimeRegistry API | JupyterLab が提供（外部依存） |
| **@jupyterlab/apputils** | コマンドパレット等の UI ユーティリティ | JupyterLab が提供（外部依存） |
| **@lumino/widgets** | Widget 基盤 | JupyterLab が提供（外部依存） |

JupyterLab が提供するパッケージは `peerDependencies` / `devDependencies` に記載し、
バンドルには含めない（JupyterLab のランタイムから提供される）。
reveal.js は `dependencies` に記載し、@jupyterlab/builder がバンドルに含める。
これによりネットワーク接続なしでの動作を保証する。

#### Python 依存（pyproject.toml）

| パッケージ | 種類 | 用途 |
|---|---|---|
| **jupyterlab** (>=4.0.0) | 必須 | ホスト環境 |
| **jupyterlab-myst** | 必須 | MyST Markdown レンダリング |
| **jupyterlab-gridwidth** | 推奨（optional） | セル幅制御（横並びレイアウト） |

jupyterlab-gridwidth がなくても本拡張は動作する。
gridwidth-* タグが付いたセルは単に幅指定が無視されフル幅で表示される。
pyproject.toml では `[project.optional-dependencies]` に記載する:

```toml
[project.optional-dependencies]
gridwidth = ["jupyterlab-gridwidth"]
docs = ["jupyter-book"]
```

これによりユーザーは `pip install jupyterlab-myst-revealjs[gridwidth]` で
gridwidth 対応を含めてインストールできる。

### 3.6 拡張の配布方式

**prebuilt 拡張**として配布する。

- ユーザーは `pip install jupyterlab-myst-revealjs` でインストール完了
- JupyterLab の再ビルド（`jupyter lab build`）は不要
- ユーザー環境に Node.js は不要
- @jupyterlab/builder がビルド時にバンドルを生成し、
  Python パッケージに同梱して配布する

### 3.7 テスト戦略

| 種類 | ツール | 対象 |
|---|---|---|
| **単体テスト** | Jest | SlideBuilder の変換ロジック（NotebookModel → reveal.js DOM） |
| **統合テスト** | Playwright + Galata | JupyterLab 上での E2E テスト（スライドモード起動、表示確認） |
| **CI** | GitHub Actions | Linux（Ubuntu）+ Windows の両環境で実行 |

テストは copier テンプレートが生成するテスト基盤をそのまま使用する。
CI では Linux と Windows の両方でテストを実行し、
クロスプラットフォームの問題（パス区切り、シンボリックリンク等）を検出する。

### 3.8 ドキュメント

**Jupyter Book** を使用して本プロジェクトのドキュメントを作成する。

| 項目 | 内容 |
|---|---|
| **ツール** | Jupyter Book |
| **ソース形式** | MyST Markdown |
| **ホスティング** | GitHub Pages（予定） |

採用理由:
- 本プロジェクトは Jupyter Book エコシステムの一部であり、
  ドキュメント自体が Jupyter Book の使用例となる
- MyST Markdown で書かれたドキュメントが JupyterLab 上で
  jupyterlab-myst によりそのまま表示できることを示す実例にもなる
- ドキュメント内にライブ実行可能なノートブックを含められるため、
  チュートリアルやデモをインタラクティブに提供できる

### 3.9 reveal.js CSS の隔離

§1.2 で述べた通り、DocumentRegistry WidgetFactory 方式により
SlideshowPanel は NotebookPanel とは完全に独立した DOM ツリーを持つ。
このため、reveal.js の CSS は SlideshowPanel の DOM ツリー内に
構造的に閉じ込められ、JupyterLab の CSS と競合しない。

ただし、reveal.js の CSS にはグローバルセレクタ（`body`, `*` 等）を
使用するルールが含まれる可能性があるため、
SlideshowPanel のルート要素に固有クラスを付与し、
reveal.js の CSS をインポートする際にそのスコープ下に限定する。
この対応は原理的に単純であり、アーキテクチャ上の課題ではない。


## 4. MVP Feasibility 評価

### 4.1 技術的 Feasibility

| MVP 完了基準 | Feasibility | 備考 |
|---|---|---|
| 1. slideshow メタデータの読み取り | ✅ 可能 | CellModel.getMetadata() |
| 2. Ctrl+R でスライドモード開始 | ✅ 可能 | JupyterLab コマンド登録 |
| 3. MyST レンダリングの表示 | ✅ 可能 | RenderMimeRegistry 経由で jupyterlab-myst に委譲 |
| 4. コードセル実行と出力反映 | ✅ 可能 | DocumentContext でカーネル共有 |
| 5. hide-input トグル | ✅ 可能 | フロントエンド変換で実装 |
| 6. remove-cell 除去 | ✅ 可能 | フロントエンド変換で実装 |
| 7. gridwidth タグ反映 | ✅ 可能 | セルタグベース、CSS で実装（下記参照） |
| 8. フルスクリーン（F11） | ✅ 可能 | ブラウザ標準機能 |

**gridwidth 調査結果**:
jupyterlab-gridwidth は独自のメタデータ形式ではなく、
標準的なセルタグ（`gridwidth-1-2`, `gridwidth-1-3`, `gridwidth-2-3` 等）を使用する。
レンダリングは CSS のみ。hide-input / remove-cell と同じタグベースの仕組みであり、
フロントエンドの変換ロジックで統一的に扱える。

注意点として、jupyterlab-gridwidth は JupyterLab 4.2 以降の
仮想レンダリング（windowingMode: full）と非互換であり、
defer に変更する必要がある。ただし、本プロジェクトでは独自の
DocumentWidget でスライドビューを構築するため、
この問題は発生しない（ノートブックビューの仮想レンダリングに依存しない）。

### 4.2 残る確認項目

**MVP の全 8 項目は、使用する技術要素がすべて JupyterLab の公開 API として
存在することから、原理的に Feasible であると判断した。**

ただし、以下の2点は実装時に具体的な方法を確認する必要がある。
特に項目 1 は本アーキテクチャの前提条件であり、
万一機能しなければ代替アプローチの検討が必要になる:

1. **DocumentContext の共有**: 同じ .ipynb に対して
   NotebookPanel とカスタム DocumentWidget が
   同一の context を共有する具体的な実装方法。
   JupyterLab の「New View for Notebook」機能が同じ仕組みで
   動作しているため、原理的には可能だが、
   カスタム WidgetFactory からの利用方法を確認する必要がある。
2. **RenderMimeRegistry の利用**: カスタム DocumentWidget から
   RenderMimeRegistry にアクセスして Markdown セルや
   コード出力をレンダリングする具体的な方法。


## 5. 次のステップ

### 5.1 実装時の確認項目

1. **DocumentContext の共有の実装方法**（§4.2 項目 1）
2. **RenderMimeRegistry のカスタム DocumentWidget からの利用方法**（§4.2 項目 2）

### 5.2 設計フェーズ

上記を踏まえて:

1. SlideshowWidgetFactory の登録と JupyterLab との統合
   - WidgetFactory の登録（DocumentRegistry への追加）
   - コマンド登録（Ctrl+R キーバインド → WidgetFactory 経由でスライドビューを開く）
   - 「Open With > Slideshow」メニューへの追加
2. SlideshowPanel（DocumentWidget）の具体的なクラス設計
3. SlideBuilder（フロントエンド変換ロジック）の詳細設計
   - セルタグの統一的処理（hide-input, remove-cell, gridwidth-* を同じパターンで）
   - NotebookModel → reveal.js DOM の変換ロジック


---

## 付録: 設計判断の経緯

1. **歴史的教訓の分析**: RISE（DOM 変形）と jupyterlab-rise（別 URL）の
   失敗から、2つの教訓を導出
2. **DocumentRegistry WidgetFactory アプローチの選択**:
   教訓 1, 2 を同時に回避し、ビューレイヤー原則に合致
3. **コンパイラのアナロジー**: フロントエンド（Notebook → reveal.js DOM）、
   中間表現（reveal.js DOM）、バックエンド（reveal.js エンジン）の3層構造
4. **MyST レンダリングの委譲**: RenderMimeRegistry 経由で jupyterlab-myst を利用。
   セルの配置・レイアウトは本プロジェクトが CSS で自由に制御でき、
   通常のスライド用途では十分。限界は PowerPoint / Beamer 級の独自レンダリング
5. **jupyterlab-gridwidth の調査完了**: セルタグベース（gridwidth-1-2 等）で
   CSS のみのレンダリング。hide-input / remove-cell と同一パターンで処理可能。
   MVP 全 8 項目の Feasibility が確認された
6. **技術スタックの選定**: copier テンプレート、TypeScript、prebuilt 拡張配布、
   reveal.js をバンドル同梱、uv、Jupyter Book によるドキュメント、
   Jest + Playwright/Galata によるテスト
7. **DOM と HTML の用語整理、レンダラーの役割の明確化**:
   jupyterlab-myst は yacc 相当（セル内容の DOM 生成）、
   reveal.js はバックエンド（スライドショー表示）、
   本プロジェクトはコード生成器相当（DOM の組み立て）。
   技術的本質の1行要約に帰着
8. **開発環境の構築完了**:
   copier テンプレート（frontend 種別）でプロジェクト骨格を生成。
   Python 3.13 + uv + jlpm。
   JupyterLab 上でテンプレート雛形拡張のロードを確認済み。
   次のステップは §5 に記載の確認項目と設計フェーズ
