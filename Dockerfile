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

# ポート指定（Streamlitのデフォルトは8501）
EXPOSE 8501

# 環境変数（Rendr用にhost/portを指定）
ENV PORT=10000
ENV STREAMLIT_SERVER_PORT=10000
ENV STREAMLIT_SERVER_ADDRESS=0.0.0.0

# 起動コマンド
CMD ["streamlit", "run", "app.py", "--server.port=10000", "--server.address=0.0.0.0"]