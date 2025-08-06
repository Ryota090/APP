# ベースイメージ
FROM python:3.11-slim

# 作業ディレクトリ作成
WORKDIR /app

# 依存ファイルコピー
COPY requirements.txt ./

# 依存パッケージインストール
RUN pip install --no-cache-dir -r requirements.txt

# アプリ本体コピー
COPY . .

# ポート指定
EXPOSE 5000

# 環境変数
ENV FLASK_ENV=production
ENV FLASK_DEBUG=false

# 起動コマンド
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:5000"]