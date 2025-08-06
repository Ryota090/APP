from flask import Flask, render_template, send_from_directory, jsonify, request, session, redirect, url_for
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
import os
import sqlite3
import bcrypt
import json
from datetime import datetime, timedelta
import secrets
from cryptography.fernet import Fernet
import hashlib
import re
from functools import wraps

app = Flask(__name__)

# セキュリティ設定
app.secret_key = os.environ.get('SECRET_KEY', Fernet.generate_key())
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=2)

# CORS設定（本番環境では無効化）
CORS(app, origins=['https://your-domain.com'])

# セキュリティヘッダー設定
Talisman(app, 
    content_security_policy={
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        'style-src': ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        'font-src': ["'self'", "https://cdnjs.cloudflare.com"],
        'img-src': ["'self'", "data:", "https:"],
    },
    force_https=True
)

# レート制限設定
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# セキュリティ設定
MAX_LOGIN_ATTEMPTS = 5
LOGIN_TIMEOUT = 300  # 5分
SESSION_TIMEOUT = 7200  # 2時間

# データベース初期化
def init_database():
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    
    # ユーザーテーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR UNIQUE NOT NULL,
            password_hash VARCHAR NOT NULL,
            role VARCHAR DEFAULT 'staff',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 売上履歴テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            quantity_sold INTEGER NOT NULL,
            sale_price INTEGER NOT NULL,
            sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,
            FOREIGN KEY (product_id) REFERENCES products (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # ログイン試行履歴テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address VARCHAR NOT NULL,
            username VARCHAR NOT NULL,
            attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            success BOOLEAN DEFAULT FALSE
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
            ("PTS003", "スキニーパンツ", 4500, 30),
            ("DRS004", "ワンピース", 6500, 15),
            ("SNK005", "スニーカー", 12000, 25)
        ]
        cursor.executemany("INSERT INTO products (sku, name, price, quantity) VALUES (?, ?, ?, ?)", 
                          sample_products)
    
    conn.commit()
    conn.close()

# セキュリティ関数
def hash_password(password):
    """強力なパスワードハッシュ化"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def verify_password(password, hashed):
    """パスワード検証"""
    try:
        if isinstance(hashed, bytes):
            return bcrypt.checkpw(password.encode('utf-8'), hashed)
        else:
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except:
        return False

def validate_input(text, max_length=100):
    """入力値検証"""
    if not text or len(text) > max_length:
        return False
    # SQLインジェクション対策
    dangerous_patterns = [
        ';', '--', '/*', '*/', 
        'union', 'select', 'insert', 'update', 'delete', 'drop',
        'create', 'alter', 'exec', 'execute'
    ]
    text_lower = text.lower()
    for pattern in dangerous_patterns:
        if pattern in text_lower and len(pattern) > 2:
            return False
    return True

def check_rate_limit(ip_address, username):
    """レート制限チェック"""
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    
    # 過去5分間の試行回数をチェック
    five_minutes_ago = datetime.now() - timedelta(minutes=5)
    cursor.execute("""
        SELECT COUNT(*) FROM login_attempts 
        WHERE ip_address = ? AND username = ? AND attempt_time > ?
    """, (ip_address, username, five_minutes_ago))
    
    attempts = cursor.fetchone()[0]
    conn.close()
    
    return attempts < MAX_LOGIN_ATTEMPTS

def log_login_attempt(ip_address, username, success):
    """ログイン試行を記録"""
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO login_attempts (ip_address, username, success) 
        VALUES (?, ?, ?)
    """, (ip_address, username, success))
    conn.commit()
    conn.close()

def login_required(f):
    """ログイン必須デコレータ"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """管理者権限必須デコレータ"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        if session.get('role') != 'admin':
            return jsonify({'error': '管理者権限が必要です'}), 403
        return f(*args, **kwargs)
    return decorated_function

# ルート - メインページ
@app.route('/')
@login_required
def index():
    return render_template('index.html')

# ログインページ
@app.route('/login')
def login():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('login.html')

# ログイン処理
@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")
def login_api():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'ユーザー名とパスワードを入力してください'})
    
    # レート制限チェック
    if not check_rate_limit(request.remote_addr, username):
        log_login_attempt(request.remote_addr, username, False)
        return jsonify({'success': False, 'message': f'ログイン試行回数が上限に達しました。{LOGIN_TIMEOUT}秒後に再試行してください。'})
    
    # 入力値検証
    if not validate_input(username) or not validate_input(password):
        log_login_attempt(request.remote_addr, username, False)
        return jsonify({'success': False, 'message': '無効な入力です'})
    
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, role, password_hash FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    if user and verify_password(password, user[2]):
        # ログイン成功
        session.permanent = True
        session['user_id'] = user[0]
        session['username'] = username
        session['role'] = user[1]
        session['login_time'] = datetime.now().isoformat()
        
        # 最終ログイン時間を更新
        cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (datetime.now(), user[0]))
        conn.commit()
        
        log_login_attempt(request.remote_addr, username, True)
        conn.close()
        
        return jsonify({
            'success': True, 
            'user': {
                'id': user[0],
                'username': username,
                'role': user[1]
            }
        })
    else:
        log_login_attempt(request.remote_addr, username, False)
        conn.close()
        return jsonify({'success': False, 'message': 'ユーザー名またはパスワードが違います'})

# ログアウト
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

# ダッシュボードデータAPI
@app.route('/api/dashboard', methods=['GET'])
@login_required
def get_dashboard_data():
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    
    # 総商品数
    cursor.execute("SELECT COUNT(*) FROM products")
    total_products = cursor.fetchone()[0]
    
    # 総在庫数
    cursor.execute("SELECT SUM(quantity) FROM products")
    total_stock = cursor.fetchone()[0] or 0
    
    # 低在庫商品（10個以下）
    cursor.execute("SELECT COUNT(*) FROM products WHERE quantity <= 10")
    low_stock = cursor.fetchone()[0]
    
    # 今日の売上
    cursor.execute("""
        SELECT SUM(quantity_sold * sale_price) 
        FROM sales_history 
        WHERE DATE(sale_date) = DATE('now')
    """)
    today_sales = cursor.fetchone()[0] or 0
    
    # 今週の売上
    cursor.execute("""
        SELECT SUM(quantity_sold * sale_price) 
        FROM sales_history 
        WHERE sale_date >= DATE('now', '-7 days')
    """)
    weekly_sales = cursor.fetchone()[0] or 0
    
    conn.close()
    
    return jsonify({
        'total_products': total_products,
        'total_stock': total_stock,
        'low_stock': low_stock,
        'today_sales': today_sales,
        'weekly_sales': weekly_sales
    })

# 商品一覧API
@app.route('/api/products', methods=['GET'])
@login_required
def get_products():
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, sku, name, price, quantity FROM products ORDER BY name")
    products = cursor.fetchall()
    conn.close()
    
    return jsonify([{
        'id': p[0],
        'sku': p[1],
        'name': p[2],
        'price': p[3],
        'quantity': p[4]
    } for p in products])

# 商品追加API
@app.route('/api/products', methods=['POST'])
@login_required
def add_product():
    data = request.get_json()
    sku = data.get('sku')
    name = data.get('name')
    price = data.get('price')
    quantity = data.get('quantity', 0)
    
    if not all([sku, name, price]):
        return jsonify({'success': False, 'message': '必須項目を入力してください'})
    
    # 入力値検証
    if not all(validate_input(field) for field in [sku, name]):
        return jsonify({'success': False, 'message': '無効な入力です'})
    
    try:
        conn = sqlite3.connect('inventory.db')
        cursor = conn.cursor()
        cursor.execute("INSERT INTO products (sku, name, price, quantity) VALUES (?, ?, ?, ?)", 
                      (sku, name, price, quantity))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': '商品を追加しました'})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'SKUが重複しています'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラーが発生しました: {str(e)}'})

# 在庫更新API
@app.route('/api/products/<int:product_id>/stock', methods=['PUT'])
@login_required
def update_stock(product_id):
    data = request.get_json()
    quantity = data.get('quantity')
    
    if quantity is None:
        return jsonify({'success': False, 'message': '数量を指定してください'})
    
    try:
        conn = sqlite3.connect('inventory.db')
        cursor = conn.cursor()
        cursor.execute("UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?", 
                      (quantity, datetime.now(), product_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': '在庫を更新しました'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラーが発生しました: {str(e)}'})

# 売上登録API
@app.route('/api/sales', methods=['POST'])
@login_required
def add_sale():
    data = request.get_json()
    product_id = data.get('product_id')
    quantity_sold = data.get('quantity_sold')
    sale_price = data.get('sale_price')
    
    if not all([product_id, quantity_sold, sale_price]):
        return jsonify({'success': False, 'message': '必須項目を入力してください'})
    
    try:
        conn = sqlite3.connect('inventory.db')
        cursor = conn.cursor()
        
        # 在庫チェック
        cursor.execute("SELECT quantity FROM products WHERE id = ?", (product_id,))
        current_stock = cursor.fetchone()
        if not current_stock or current_stock[0] < quantity_sold:
            conn.close()
            return jsonify({'success': False, 'message': '在庫が不足しています'})
        
        # 売上履歴を追加
        cursor.execute("""
            INSERT INTO sales_history (product_id, quantity_sold, sale_price, user_id) 
            VALUES (?, ?, ?, ?)
        """, (product_id, quantity_sold, sale_price, session['user_id']))
        
        # 在庫を減らす
        cursor.execute("UPDATE products SET quantity = quantity - ?, updated_at = ? WHERE id = ?", 
                      (quantity_sold, datetime.now(), product_id))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': '売上を登録しました'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラーが発生しました: {str(e)}'})

# 売上分析API
@app.route('/api/sales/analysis', methods=['GET'])
@login_required
def get_sales_analysis():
    period = request.args.get('period', '30')
    
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    
    # 期間内の売上データ
    cursor.execute("""
        SELECT p.name, SUM(sh.quantity_sold * sh.sale_price) as total_sales, 
               SUM(sh.quantity_sold) as total_quantity
        FROM sales_history sh
        JOIN products p ON sh.product_id = p.id
        WHERE sh.sale_date >= DATE('now', '-{} days')
        GROUP BY p.id, p.name
        ORDER BY total_sales DESC
    """.format(period))
    
    sales_data = cursor.fetchall()
    
    # 日別売上推移
    cursor.execute("""
        SELECT DATE(sh.sale_date) as sale_date, 
               SUM(sh.quantity_sold * sh.sale_price) as daily_sales
        FROM sales_history sh
        WHERE sh.sale_date >= DATE('now', '-{} days')
        GROUP BY DATE(sh.sale_date)
        ORDER BY sale_date
    """.format(period))
    
    daily_sales = cursor.fetchall()
    
    conn.close()
    
    return jsonify({
        'product_sales': [{
            'name': row[0],
            'total_sales': row[1],
            'total_quantity': row[2]
        } for row in sales_data],
        'daily_sales': [{
            'date': row[0],
            'sales': row[1]
        } for row in daily_sales]
    })

# 静的ファイルの提供
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    init_database()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)