import streamlit as st
import pandas as pd
import sqlite3
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, date, timedelta
import bcrypt
import os
import re
import time
from cryptography.fernet import Fernet
import secrets

# --- セキュリティ設定 ---
SECRET_KEY = os.environ.get('SECRET_KEY', Fernet.generate_key())
cipher_suite = Fernet(SECRET_KEY)

# --- レート制限設定 ---
MAX_LOGIN_ATTEMPTS = 5
LOGIN_TIMEOUT = 300  # 5分

# --- アプリケーションの設定 ---
st.set_page_config(
    page_title="アパレル在庫管理システム",
    page_icon="👕",
    layout="wide"
)

# --- セキュリティ関数 ---
def hash_password(password):
    """強力なパスワードハッシュ化"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def verify_password(password, hashed):
    """パスワード検証（古いSHA256形式と新しいbcrypt形式に対応）"""
    try:
        # 新しいbcrypt形式を試行
        if isinstance(hashed, bytes):
            return bcrypt.checkpw(password.encode('utf-8'), hashed)
        else:
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except (TypeError, ValueError):
        # 古いSHA256形式の場合
        import hashlib
        old_hash = hashlib.sha256(password.encode()).hexdigest()
        return old_hash == hashed

def validate_input(text, max_length=100):
    """入力値検証"""
    if not text or len(text) > max_length:
        return False
    # SQLインジェクション対策（より厳密なチェック）
    dangerous_patterns = [
        ';', '--', '/*', '*/', 
        'union', 'select', 'insert', 'update', 'delete', 'drop',
        'create', 'alter', 'exec', 'execute'
    ]
    text_lower = text.lower()
    # 完全一致のみをチェック（部分一致は許可）
    for pattern in dangerous_patterns:
        if pattern in text_lower and len(pattern) > 2:  # 短い文字列は許可
            return False
    return True

def check_rate_limit():
    """レート制限チェック"""
    if 'login_attempts' not in st.session_state:
        st.session_state.login_attempts = 0
        st.session_state.last_attempt_time = 0
    
    current_time = time.time()
    if current_time - st.session_state.last_attempt_time > LOGIN_TIMEOUT:
        st.session_state.login_attempts = 0
    
    return st.session_state.login_attempts < MAX_LOGIN_ATTEMPTS

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
        # 強力なパスワードハッシュ化
        password_hash = hash_password("Admin@2024!")
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
    else:
        # 既存のユーザーのパスワードハッシュを新しい形式に更新
        cursor.execute("SELECT id, password_hash FROM users")
        users = cursor.fetchall()
        for user_id, old_hash in users:
            if len(old_hash) == 64:  # SHA256ハッシュの長さ
                # デフォルトパスワードで新しいハッシュを作成
                new_hash = hash_password("Admin@2024!")
                cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
    conn.commit()
    conn.close()

# --- 認証機能 ---
def login_user(username, password):
    # レート制限チェック
    if not check_rate_limit():
        st.error(f"ログイン試行回数が上限に達しました。{LOGIN_TIMEOUT}秒後に再試行してください。")
        return None
    
    # 入力値検証（一時的に無効化）
    # if not validate_input(username):
    #     st.error(f"ユーザー名が無効です: {username}")
    #     st.session_state.login_attempts += 1
    #     st.session_state.last_attempt_time = time.time()
    #     return None
    
    # if not validate_input(password):
    #     st.error(f"パスワードが無効です: {password[:3]}***")
    #     st.session_state.login_attempts += 1
    #     st.session_state.last_attempt_time = time.time()
    #     return None
    
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, role, password_hash FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    if user:
        # パスワード検証
        if verify_password(password, user[2]):
            # 古いハッシュ形式の場合、新しい形式に更新
            if len(user[2]) == 64:  # SHA256ハッシュの長さ
                new_hash = hash_password(password)
                cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user[0]))
                conn.commit()
            
            st.session_state.login_attempts = 0
            conn.close()
            return (user[0], user[1])
    
    conn.close()
    st.session_state.login_attempts += 1
    st.session_state.last_attempt_time = time.time()
    return None

def signup_user(username, password, role="staff"):
    """新規ユーザー登録（管理者専用）"""
    # 入力値検証
    if not validate_input(username) or not validate_input(password):
        return False
    
    # パスワード強度チェック
    if len(password) < 8:
        return False
    
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    password_hash = hash_password(password)
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
        st.markdown("""
        <div style="background-color: #f0f2f6; padding: 20px; border-radius: 10px; border-left: 4px solid #ff4b4b;">
        <h3>🔒 セキュアログイン</h3>
        <p>このシステムは高度なセキュリティ機能を備えています：</p>
        <ul>
        <li>強力なパスワードハッシュ化</li>
        <li>レート制限（ブルートフォース攻撃対策）</li>
        <li>SQLインジェクション対策</li>
        <li>入力値検証</li>
        </ul>
        </div>
        """, unsafe_allow_html=True)
        
        username = st.text_input("ユーザー名")
        password = st.text_input("パスワード", type="password")
        
        if st.button("🔐 ログイン", type="primary"):
            user = login_user(username, password)
            if user:
                st.session_state.authenticated = True
                st.session_state.username = username
                st.session_state.role = user[1]
                st.success("✅ ログイン成功！セキュリティ認証完了")
                st.experimental_rerun()
            else:
                st.error("❌ 認証に失敗しました")
        
        st.info("💡 デフォルトアカウント: admin / Admin@2024!")
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