import streamlit as st
import pandas as pd
import sqlite3
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, date, timedelta
import hashlib
import os

# --- アプリケーションの設定 ---
st.set_page_config(
    page_title="アパレル在庫管理システム",
    page_icon="👕",
    layout="wide"
)

# --- データベース初期化 ---
def init_database():
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR UNIQUE NOT NULL,
            password_hash VARCHAR NOT NULL,
            role VARCHAR DEFAULT 'staff'
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku VARCHAR UNIQUE NOT NULL,
            name VARCHAR NOT NULL,
            price INTEGER NOT NULL,
            quantity INTEGER DEFAULT 0
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            quantity_sold INTEGER NOT NULL,
            sale_price INTEGER NOT NULL,
            sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products (id)
        )
    ''')
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        password_hash = hashlib.sha256("admin123".encode()).hexdigest()
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                      ("admin", password_hash, "admin"))
        sample_products = [
            ("TSH001", "ベーシックTシャツ", 2500, 50),
            ("JKT002", "デニムジャケット", 8500, 20),
            ("PTS003", "スキニーパンツ", 4500, 30),
            ("DRS004", "ワンピース", 6500, 15),
            ("SNK005", "スニーカー", 12000, 25)
        ]
        cursor.executemany("INSERT INTO products (sku, name, price, quantity) VALUES (?, ?, ?, ?)", 
                          sample_products)
    conn.commit()
    conn.close()

# --- 認証機能 ---
def login_user(username, password):
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    cursor.execute("SELECT id, role FROM users WHERE username = ? AND password_hash = ?", 
                  (username, password_hash))
    user = cursor.fetchone()
    conn.close()
    return user

def signup_user(username, password, role="staff"):
    """新規ユーザー登録（管理者専用）"""
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    try:
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (username, password_hash, role))
        conn.commit()
        success = True
    except sqlite3.IntegrityError:
        success = False
    conn.close()
    return success

def check_auth():
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
    return st.session_state.authenticated

# --- メインアプリケーション ---
def main():
    st.title("アパレル在庫管理システム")
    init_database()

    if not check_auth():
        username = st.text_input("ユーザー名")
        password = st.text_input("パスワード", type="password")
        if st.button("ログイン"):
            user = login_user(username, password)
            if user:
                st.session_state.authenticated = True
                st.session_state.username = username
                st.session_state.role = user[1]
                st.success("ログイン成功")
                st.experimental_rerun()
            else:
                st.error("ユーザー名またはパスワードが違います")
        st.info("アカウントが必要な場合は管理者に連絡してください。")
        return

    # 認証済みユーザーのみここから
    st.sidebar.title("👕 アパレル在庫管理")
    menu_options = ["📊 ダッシュボード", "📦 商品管理", "📥 在庫管理", "💰 売上登録", "📈 売上分析"]
    if st.session_state.role == "admin":
        menu_options.append("👤 ユーザー管理")
    page = st.sidebar.selectbox("メニューを選択", menu_options)

    # 各ページの処理（show_user_managementなど）はここで呼び出し
    # 例:
    # if page == "👤 ユーザー管理":
    #     show_user_management()
    # ...他のページ...

if __name__ == "__main__":
    import os
    # Render用のポート設定
    port = int(os.environ.get("PORT", 8501))
    main()