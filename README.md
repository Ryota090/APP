# アパレル在庫管理システム

Flaskを使用したセキュアなWebベースのアパレル在庫管理システムです。

## 🔒 セキュリティ機能

* **強力なパスワードハッシュ化**: bcryptを使用
* **レート制限**: ブルートフォース攻撃対策（5分間に5回まで）
* **SQLインジェクション対策**: 入力値検証とプリペアドステートメント
* **セッション管理**: 安全なセッション処理（2時間で自動ログアウト）
* **セキュリティヘッダー**: CSP、HTTPS強制、XSS対策
* **CSRF保護**: セッションベースの保護
* **ログイン試行記録**: IPアドレスとユーザー名による追跡

## 機能

* 📊 ダッシュボード（リアルタイム統計）
* 📦 商品管理（追加・編集・削除）
* 📥 在庫管理（入庫・出庫処理）
* 💰 売上登録（在庫連動）
* 📈 売上分析（期間別・商品別）
* 👤 ユーザー管理（管理者専用）

## 技術スタック

* **フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
* **バックエンド**: Flask (Python)
* **データベース**: SQLite
* **データ可視化**: Chart.js
* **セキュリティ**: Flask-Talisman, Flask-Limiter, bcrypt
* **デプロイ**: Render, Gunicorn

## ローカル開発

### 前提条件

* Python 3.11以上
* pip

### セットアップ

1. リポジトリをクローン
```bash
git clone https://github.com/Ryota090/APP.git
cd APP
```

2. 依存関係をインストール
```bash
pip install -r requirements.txt
```

3. アプリケーションを起動
```bash
python app.py
```

4. ブラウザで `http://localhost:5000` にアクセス

### デフォルトログイン情報

* **ユーザー名**: admin
* **パスワード**: Admin@2024!

## Renderでのデプロイ

### 手順

1. Render にアカウントを作成
2. GitHubリポジトリをRenderに接続  
   * Renderダッシュボードで「New +」→「Web Service」を選択  
   * GitHubリポジトリを選択
3. 設定  
   * **Name**: apparel-inventory-app  
   * **Environment**: Python  
   * **Build Command**: `pip install -r requirements.txt`  
   * **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
4. 環境変数（自動設定）  
   * `PYTHON_VERSION`: 3.11.8  
   * `SECRET_KEY`: 自動生成
   * `FLASK_ENV`: production
5. 「Create Web Service」をクリック

### 自動デプロイ

`render.yaml`ファイルが設定されているため、GitHubにプッシュすると自動的にデプロイされます。

## ファイル構成

```
├── app.py              # メインアプリケーション（Flask）
├── requirements.txt    # Python依存関係
├── render.yaml         # Render設定
├── Dockerfile          # Docker設定
├── inventory.db        # SQLiteデータベース
├── templates/          # HTMLテンプレート
│   ├── login.html      # ログインページ
│   └── index.html      # メインアプリケーション
├── static/             # 静的ファイル
│   └── app.js          # JavaScriptファイル
└── README.md           # このファイル
```

## API エンドポイント

### 認証
- `POST /api/login` - ログイン
- `POST /api/logout` - ログアウト

### ダッシュボード
- `GET /api/dashboard` - ダッシュボードデータ

### 商品管理
- `GET /api/products` - 商品一覧
- `POST /api/products` - 商品追加
- `PUT /api/products/<id>/stock` - 在庫更新

### 売上管理
- `POST /api/sales` - 売上登録
- `GET /api/sales/analysis` - 売上分析

## セキュリティ対策詳細

### パスワードセキュリティ
- bcryptによる強力なハッシュ化
- ソルト自動生成
- パスワード強度チェック

### セッションセキュリティ
- セッションタイムアウト（2時間）
- セキュアクッキー設定
- セッション固定攻撃対策

### 入力値検証
- SQLインジェクション対策
- XSS対策
- 入力長制限

### レート制限
- IPアドレスベース
- ユーザー名ベース
- 時間枠制限

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 更新履歴

- v2.0.0: FlaskベースのセキュアなWebアプリケーションに統合
- v1.0.0: Streamlitベースの初期版 