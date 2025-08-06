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
        
        # データベースディレクトリの作成
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
            print(f"データベースディレクトリを作成: {db_dir}")
        
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
        user_count = cursor.fetchone()[0]
        print(f"既存のユーザー数: {user_count}")
        
        if user_count == 0:
            print("初期ユーザーを作成中...")
            password = "Admin@2024!"
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            print(f"パスワード: {password}")
            print(f"ハッシュ: {password_hash}")
            
            cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                          ("admin", password_hash, "admin"))
            print("adminユーザーを作成しました")
            
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
        
        print(f"=== ログイン試行 ===")
        print(f"ユーザー名: {username}")
        print(f"パスワード: {password}")
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'ユーザー名とパスワードを入力してください'})
        
        db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        print(f"データベースパス: {db_path}")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, role, password_hash FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if user:
            print(f"ユーザーが見つかりました: {user[1]}")
            print(f"DBパスワードハッシュ: {user[2]}")
            
            password_valid = verify_password(password, user[2])
            print(f"パスワード検証結果: {password_valid}")
            
            if password_valid:
                session.permanent = True
                session['user_id'] = user[0]
                session['username'] = username
                session['role'] = user[1]
                
                conn.close()
                print("ログイン成功")
                return jsonify({'success': True, 'user': {'username': username, 'role': user[1]}})
            else:
                conn.close()
                print("パスワードが間違っています")
                return jsonify({'success': False, 'message': 'パスワードが間違っています'})
        else:
            conn.close()
            print("ユーザーが見つかりません")
            return jsonify({'success': False, 'message': 'ユーザーが見つかりません'})
            
    except Exception as e:
        print(f"ログインエラー: {e}")
        import traceback
        print(f"エラー詳細: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': 'ログイン処理エラー'})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/init-db', methods=['POST'])
def init_database_api():
    try:
        print("=== データベース初期化API呼び出し ===")
        init_database()
        
        # 初期化後の確認
        db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT username, role FROM users")
        users = cursor.fetchall()
        conn.close()
        
        print(f"初期化後のユーザー: {users}")
        return jsonify({'success': True, 'message': f'データベースが初期化されました。ユーザー: {users}'})
    except Exception as e:
        print(f"データベース初期化APIエラー: {e}")
        import traceback
        print(f"エラー詳細: {traceback.format_exc()}")
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

@app.route('/api/check-db')
def check_database():
    try:
        db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # ユーザーテーブルの確認
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        users_table_exists = cursor.fetchone() is not None
        
        if users_table_exists:
            cursor.execute("SELECT username, role FROM users")
            users = cursor.fetchall()
        else:
            users = []
        
        # 商品テーブルの確認
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")
        products_table_exists = cursor.fetchone() is not None
        
        if products_table_exists:
            cursor.execute("SELECT COUNT(*) FROM products")
            product_count = cursor.fetchone()[0]
        else:
            product_count = 0
        
        conn.close()
        
        return jsonify({
            'status': 'ok',
            'database_path': db_path,
            'users_table_exists': users_table_exists,
            'products_table_exists': products_table_exists,
            'users': users,
            'product_count': product_count
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

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