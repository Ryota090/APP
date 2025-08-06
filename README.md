# アパレル在庫管理システム

Streamlitを使用したWebベースのアパレル在庫管理システムです。

## 機能

- 📊 ダッシュボード
- 📦 商品管理
- 📥 在庫管理
- 💰 売上登録
- 📈 売上分析
- 👤 ユーザー管理（管理者専用）

## 技術スタック

- **フロントエンド**: Streamlit
- **バックエンド**: Python
- **データベース**: SQLite
- **データ可視化**: Plotly
- **データ処理**: Pandas

## ローカル開発

### 前提条件

- Python 3.11以上
- pip

### セットアップ

1. リポジトリをクローン
```bash
git clone <repository-url>
cd <repository-name>
```

2. 依存関係をインストール
```bash
pip install -r requirements.txt
```

3. アプリケーションを起動
```bash
streamlit run app.py
```

4. ブラウザで `http://localhost:8501` にアクセス

### デフォルトログイン情報

- **ユーザー名**: admin
- **パスワード**: admin123

## Renderでのデプロイ

### 手順

1. [Render](https://render.com) にアカウントを作成

2. GitHubリポジトリをRenderに接続
   - Renderダッシュボードで「New +」→「Web Service」を選択
   - GitHubリポジトリを選択

3. 設定
   - **Name**: apparel-inventory-app
   - **Environment**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `streamlit run app.py --server.port $PORT --server.address 0.0.0.0 --server.headless true`

4. 環境変数（オプション）
   - `PYTHON_VERSION`: 3.11.8
   - `STREAMLIT_SERVER_HEADLESS`: true
   - `STREAMLIT_SERVER_ENABLE_CORS`: false

5. 「Create Web Service」をクリック

### 自動デプロイ

`render.yaml`ファイルが設定されているため、GitHubにプッシュすると自動的にデプロイされます。

## ファイル構成

```
├── app.py              # メインアプリケーション
├── requirements.txt    # Python依存関係
├── render.yaml         # Render設定
├── Dockerfile          # Docker設定
├── inventory.db        # SQLiteデータベース
├── index.html          # 静的HTMLファイル
├── app.js              # JavaScriptファイル
└── README.md           # このファイル
```

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。 