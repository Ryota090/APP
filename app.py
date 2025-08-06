from flask import Flask, render_template, jsonify, request, session, redirect, url_for, send_from_directory
import os
import sqlite3
import bcrypt
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)

# 基本設定
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=2)

print("=== Flaskアプリケーション初期化完了 ===")

# データベース初期化
def init_database():
    try:
        print("=== データベース初期化開始 ===")
        db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        print(f"データベースパス: {db_path}")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # ユーザーテーブル
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR UNIQUE NOT NULL,
                password_hash VARCHAR NOT NULL,
                role VARCHAR DEFAULT 'staff',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 商品テーブル
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku VARCHAR UNIQUE NOT NULL,
                name VARCHAR NOT NULL,
                price INTEGER NOT NULL,
                quantity INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 初期データの挿入
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            password_hash = bcrypt.hashpw("Admin@2024!".encode('utf-8'), bcrypt.gensalt())
            cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                          ("admin", password_hash, "admin"))
            
            sample_products = [
                ("TSH001", "ベーシックTシャツ", 2500, 50),
                ("JKT002", "デニムジャケット", 8500, 20),
                ("PTS003", "スキニーパンツ", 4500, 30)
            ]
            cursor.executemany("INSERT INTO products (sku, name, price, quantity) VALUES (?, ?, ?, ?)", 
                              sample_products)
        
        conn.commit()
        conn.close()
        print("=== データベース初期化完了 ===")
        
    except Exception as e:
        print(f"=== データベース初期化エラー: {e} ===")
        import traceback
        print(f"エラー詳細: {traceback.format_exc()}")

# パスワード検証
def verify_password(password, hashed):
    try:
        if not isinstance(hashed, bytes):
            hashed = hashed.encode('utf-8')
        return bcrypt.checkpw(password.encode('utf-8'), hashed)
    except Exception as e:
        print(f"パスワード検証エラー: {e}")
        return False

# ログイン必須デコレータ
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# ルート
@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/login')
def login():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def login_api():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'ユーザー名とパスワードを入力してください'})
        
        db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, role, password_hash FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if user and verify_password(password, user[2]):
            session.permanent = True
            session['user_id'] = user[0]
            session['username'] = username
            session['role'] = user[1]
            
            conn.close()
            return jsonify({'success': True, 'user': {'username': username, 'role': user[1]}})
        else:
            conn.close()
            return jsonify({'success': False, 'message': 'ユーザー名またはパスワードが違います'})
            
    except Exception as e:
        print(f"ログインエラー: {e}")
        return jsonify({'success': False, 'message': 'ログイン処理エラー'})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/init-db', methods=['POST'])
def init_database_api():
    try:
        init_database()
        return jsonify({'success': True, 'message': 'データベースが初期化されました'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラー: {str(e)}'})

@app.route('/api/dashboard')
@login_required
def dashboard():
    try:
        db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM products")
        total_products = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(quantity) FROM products")
        total_stock = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return jsonify({
            'total_products': total_products,
            'total_stock': total_stock
        })
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/api/products')
@login_required
def get_products():
    try:
        db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, sku, name, price, quantity FROM products")
        products = cursor.fetchall()
        conn.close()
        
        return jsonify([{
            'id': p[0], 'sku': p[1], 'name': p[2], 'price': p[3], 'quantity': p[4]
        } for p in products])
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'message': 'アプリケーションは正常に動作しています'})

@app.route('/test')
def test():
    return jsonify({'status': 'ok', 'message': 'テストエンドポイントが正常に動作しています'})

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    print("=== アプリケーション起動開始 ===")
    try:
        init_database()
    except Exception as e:
        print(f"起動時のデータベース初期化エラー: {e}")
    
    port = int(os.environ.get('PORT', 5000))
    print(f"ポート {port} でアプリケーションを起動します")
    app.run(host='0.0.0.0', port=port, debug=False)