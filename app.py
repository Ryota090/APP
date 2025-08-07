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
        # Render環境では必ず/tmp/inventory.dbを使用
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
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
        
        # 売上履歴テーブル
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sales_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                product_name VARCHAR NOT NULL,
                quantity INTEGER NOT NULL,
                unit_price INTEGER NOT NULL,
                total_amount INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        ''')
        
        # 初期データの挿入
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"既存のユーザー数: {user_count}")
        
        if user_count == 0:
            print("初期ユーザーを作成中...")
            # デフォルトパスワードは環境変数から取得、なければ自動生成
            default_password = os.environ.get('DEFAULT_PASSWORD', 'Admin@2024!')
            password_hash = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt())
            print("初期ユーザーを作成しました")
            
            cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                          ("admin", password_hash, "admin"))
            print("adminユーザーを作成しました")
            
            # サンプル商品データ（レポートの要件に合わせて）
            sample_products = [
                ("TSH001", "ベーシックTシャツ", 2500, 50),
                ("JKT002", "デニムジャケット", 8500, 20),
                ("PTS003", "スキニーパンツ", 4500, 30),
                ("SWT004", "カジュアルスウェット", 3500, 25),
                ("SHO005", "スニーカー", 12000, 15)
            ]
            cursor.executemany("INSERT INTO products (sku, name, price, quantity) VALUES (?, ?, ?, ?)", 
                              sample_products)
            print(f"{len(sample_products)}個のサンプル商品を追加しました")
        
        conn.commit()
        conn.close()
        print("=== データベース初期化完了 ===")
        
        # 初期化後の確認
        if os.path.exists(db_path):
            print(f"データベースファイルが正常に作成されました: {db_path}")
        else:
            print(f"警告: データベースファイルが作成されませんでした: {db_path}")
        
    except Exception as e:
        print(f"=== データベース初期化エラー: {e} ===")
        import traceback
        print(f"エラー詳細: {traceback.format_exc()}")
        raise e  # エラーを再発生させる

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
        
        # Render環境では必ず/tmp/inventory.dbを使用
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
            db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        print(f"データベースパス: {db_path}")
        
        # データベースファイルの存在確認
        if not os.path.exists(db_path):
            print(f"データベースファイルが存在しません: {db_path}")
            return jsonify({'success': False, 'message': 'データベースが初期化されていません。データベース初期化ボタンをクリックしてください。'})
        
        try:
            conn = sqlite3.connect(db_path)
        except Exception as db_error:
            print(f"データベース接続エラー: {db_error}")
            return jsonify({'success': False, 'message': f'データベース接続エラー: {str(db_error)}'})
        
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
        return jsonify({'success': False, 'message': f'ログイン処理エラー: {str(e)}'})

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
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
            db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        
        print(f"初期化後のデータベースパス確認: {db_path}")
        
        if not os.path.exists(db_path):
            print(f"初期化後もデータベースファイルが存在しません: {db_path}")
            return jsonify({'success': False, 'message': 'データベース初期化に失敗しました。ファイルが作成されませんでした。'})
        
        try:
            conn = sqlite3.connect(db_path)
        except Exception as db_error:
            print(f"初期化後のデータベース接続エラー: {db_error}")
            return jsonify({'success': False, 'message': f'初期化後のデータベース接続エラー: {str(db_error)}'})
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
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
            db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        
        print(f"ダッシュボードAPI: データベースパス = {db_path}")
        
        if not os.path.exists(db_path):
            print(f"データベースファイルが存在しません: {db_path}")
            return jsonify({'error': 'データベースが初期化されていません'})
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 基本統計
        cursor.execute("SELECT COUNT(*) FROM products")
        total_products = cursor.fetchone()[0]
        print(f"総商品数: {total_products}")
        
        cursor.execute("SELECT SUM(quantity) FROM products")
        total_stock = cursor.fetchone()[0] or 0
        print(f"総在庫数: {total_stock}")
        
        # 在庫不足商品数
        cursor.execute("SELECT COUNT(*) FROM products WHERE quantity < 10")
        low_stock_count = cursor.fetchone()[0]
        print(f"在庫不足商品数: {low_stock_count}")
        
        # 総売上（売上履歴テーブルがある場合）
        try:
            cursor.execute("SELECT SUM(total_amount) FROM sales_history")
            total_sales = cursor.fetchone()[0] or 0
            print(f"総売上: {total_sales}")
        except Exception as e:
            print(f"売上履歴テーブルエラー: {e}")
            total_sales = 0
        
        # 売上データ（過去7日間）
        try:
            cursor.execute("""
                SELECT DATE(created_at) as date, SUM(total_amount) as amount 
                FROM sales_history 
                WHERE created_at >= date('now', '-7 days')
                GROUP BY DATE(created_at)
                ORDER BY date
            """)
            sales_data = [{'date': row[0], 'amount': row[1]} for row in cursor.fetchall()]
            print(f"売上データ: {sales_data}")
        except Exception as e:
            print(f"売上データ取得エラー: {e}")
            sales_data = []
        
        conn.close()
        
        result = {
            'total_products': total_products,
            'total_stock': total_stock,
            'low_stock_count': low_stock_count,
            'total_sales': total_sales,
            'sales_data': sales_data
        }
        
        print(f"ダッシュボード結果: {result}")
        return jsonify(result)
        
    except Exception as e:
        print(f"ダッシュボードエラー: {e}")
        import traceback
        print(f"エラー詳細: {traceback.format_exc()}")
        return jsonify({'error': str(e)})

@app.route('/api/products', methods=['GET'])
@login_required
def get_products():
    try:
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
            db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        
        print(f"商品API: データベースパス = {db_path}")
        
        if not os.path.exists(db_path):
            print(f"データベースファイルが存在しません: {db_path}")
            return jsonify({'error': 'データベースが初期化されていません'})
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, sku, name, price, quantity FROM products")
        products = cursor.fetchall()
        conn.close()
        
        result = [{
            'id': p[0], 'sku': p[1], 'name': p[2], 'price': p[3], 'quantity': p[4]
        } for p in products]
        
        print(f"商品一覧: {len(result)}件")
        return jsonify(result)
        
    except Exception as e:
        print(f"商品APIエラー: {e}")
        import traceback
        print(f"エラー詳細: {traceback.format_exc()}")
        return jsonify({'error': str(e)})

@app.route('/api/products', methods=['POST'])
@login_required
def add_product():
    try:
        print("=== 商品登録開始 ===")
        data = request.get_json()
        print(f"受信データ: {data}")
        
        sku = data.get('sku')
        name = data.get('name')
        price = data.get('price')
        quantity = data.get('quantity')
        
        print(f"SKU: {sku}")
        print(f"商品名: {name}")
        print(f"価格: {price}")
        print(f"数量: {quantity}")
        
        if not all([sku, name, price, quantity]):
            print("必須項目が不足しています")
            return jsonify({'success': False, 'message': 'すべての項目を入力してください'})
        
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
            db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        
        print(f"データベースパス: {db_path}")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("データベース接続成功")
        
        cursor.execute("INSERT INTO products (sku, name, price, quantity) VALUES (?, ?, ?, ?)", 
                      (sku, name, price, quantity))
        conn.commit()
        conn.close()
        
        print("商品登録成功")
        return jsonify({'success': True, 'message': '商品が追加されました'})
    except sqlite3.IntegrityError as e:
        print(f"IntegrityError: {e}")
        return jsonify({'success': False, 'message': 'SKUが既に存在します'})
    except Exception as e:
        print(f"商品登録エラー: {e}")
        import traceback
        print(f"エラー詳細: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': f'エラー: {str(e)}'})

@app.route('/api/inventory/inbound', methods=['POST'])
@login_required
def inbound_inventory():
    try:
        data = request.get_json()
        product_id = data.get('product_id')
        quantity = data.get('quantity')
        
        if not all([product_id, quantity]):
            return jsonify({'success': False, 'message': '商品と数量を選択してください'})
        
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
            db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("UPDATE products SET quantity = quantity + ? WHERE id = ?", (quantity, product_id))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '入庫処理が完了しました'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラー: {str(e)}'})

@app.route('/api/inventory/outbound', methods=['POST'])
@login_required
def outbound_inventory():
    try:
        data = request.get_json()
        product_id = data.get('product_id')
        quantity = data.get('quantity')
        
        if not all([product_id, quantity]):
            return jsonify({'success': False, 'message': '商品と数量を選択してください'})
        
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
            db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 在庫確認
        cursor.execute("SELECT quantity FROM products WHERE id = ?", (product_id,))
        current_quantity = cursor.fetchone()[0]
        
        if current_quantity < quantity:
            return jsonify({'success': False, 'message': '在庫が不足しています'})
        
        cursor.execute("UPDATE products SET quantity = quantity - ? WHERE id = ?", (quantity, product_id))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '出庫処理が完了しました'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラー: {str(e)}'})

@app.route('/api/sales', methods=['POST'])
@login_required
def add_sale():
    try:
        data = request.get_json()
        product_id = data.get('product_id')
        quantity = data.get('quantity')
        price = data.get('price')
        
        if not all([product_id, quantity, price]):
            return jsonify({'success': False, 'message': 'すべての項目を入力してください'})
        
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
            db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 商品名取得
        cursor.execute("SELECT name, quantity FROM products WHERE id = ?", (product_id,))
        product_info = cursor.fetchone()
        if not product_info:
            return jsonify({'success': False, 'message': '商品が見つかりません'})
        
        product_name, current_quantity = product_info
        
        # 在庫確認
        if current_quantity < quantity:
            return jsonify({'success': False, 'message': '在庫が不足しています'})
        
        total_amount = quantity * price
        
        # 売上登録
        cursor.execute("""
            INSERT INTO sales_history (product_id, product_name, quantity, unit_price, total_amount) 
            VALUES (?, ?, ?, ?, ?)
        """, (product_id, product_name, quantity, price, total_amount))
        
        # 在庫更新
        cursor.execute("UPDATE products SET quantity = quantity - ? WHERE id = ?", (quantity, product_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '売上が登録されました'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラー: {str(e)}'})

@app.route('/api/sales-analysis')
@login_required
def sales_analysis():
    try:
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
            db_path = os.environ.get('DATABASE_PATH', 'inventory.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 商品別売上データ
        cursor.execute("""
            SELECT product_name, SUM(total_amount) as sales 
            FROM sales_history 
            GROUP BY product_name 
            ORDER BY sales DESC
        """)
        chart_data = [{'product': row[0], 'sales': row[1]} for row in cursor.fetchall()]
        
        # 売上履歴
        cursor.execute("""
            SELECT created_at, product_name, quantity, unit_price, total_amount 
            FROM sales_history 
            ORDER BY created_at DESC 
            LIMIT 50
        """)
        sales_history = [{
            'date': row[0], 
            'product_name': row[1], 
            'quantity': row[2], 
            'price': row[3], 
            'total': row[4]
        } for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify({
            'chart_data': chart_data,
            'sales_history': sales_history
        })
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
        if os.environ.get('RENDER'):
            db_path = '/tmp/inventory.db'
        else:
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