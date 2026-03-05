from flask import Flask, jsonify, request, render_template, send_from_directory
from flask_cors import CORS
from threading import Lock
import time
import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# 简单内存数据（餐馆与菜单仍然内存）
# 丰富的数据结构
restaurants = [
    {"id": 1, "name": "老王家快餐", "cate": "中式简餐", "rating": 4.8, "distance": "800m", "badge": "口碑好店"},
    {"id": 2, "name": "小李面馆", "cate": "面点", "rating": 4.5, "distance": "1.2km", "badge": "极速达"},
    {"id": 3, "name": "蜜雪冰城", "cate": "甜点饮品", "rating": 4.9, "distance": "500m", "badge": "券后超省"},
    {"id": 4, "name": "深夜烧烤", "cate": "烧烤宵夜", "rating": 4.2, "distance": "2.5km", "badge": "越夜越香"}
]

menus = {
    1: [
        {"id": 101, "name": "宫保鸡丁", "price": 25, "desc": "经典川菜，酸甜适口，鸡肉鲜嫩", "label": "热销", "image": "dish1.png"},
        {"id": 102, "name": "鱼香肉丝", "price": 22, "desc": "色泽红亮，鱼香味浓，下饭神器", "label": "招牌", "image": "dish2.png"},
        {"id": 103, "name": "麻婆豆腐", "price": 15, "desc": "麻辣鲜香烫，地道川味", "label": "超值", "image": "dish_plain.png"}
    ],
    2: [
        {"id": 201, "name": "牛肉拉面", "price": 28, "desc": "现拉拉面，汤底醇厚，牛肉大片", "label": "人气", "image": "dish2.png"},
        {"id": 202, "name": "炸酱面", "price": 18, "desc": "老北京风味，酱香浓郁", "label": "地道", "image": "dish1.png"}
    ],
    3: [
        {"id": 301, "name": "冰鲜柠檬水", "price": 4, "desc": "大片柠檬，酸爽解渴", "label": "必点", "image": "drink1.png"},
        {"id": 302, "name": "芋圆奶茶", "price": 12, "desc": "奶香浓郁，芋圆Q弹", "label": "人气", "image": "drink2.png"}
    ],
    4: [
        {"id": 401, "name": "羊肉串", "price": 5, "desc": "现穿现烤，肉质鲜嫩", "label": "必点", "image": "dish2.png"},
        {"id": 402, "name": "烤生蚝", "price": 10, "desc": "个大肥美，蒜香四溢", "label": "招牌", "image": "dish1.png"}
    ]
}

# SQLite 持久化
DB_PATH = os.path.join(os.path.dirname(__file__), 'orders.db')
order_lock = Lock()


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT,
        phone TEXT,
        is_admin INTEGER DEFAULT 0
    )
    ''')
    
    # 检查 users 是否有 is_admin 列
    c.execute("PRAGMA table_info(users);")
    user_cols = [col[1] for col in c.fetchall()]
    if 'is_admin' not in user_cols:
        c.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")

    c.execute('''
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        customer_phone TEXT,
        status TEXT,
        created_at REAL,
        user_id INTEGER
    )
    ''')
    # 检查 orders 是否有 user_id 列
    c.execute("PRAGMA table_info(orders);")
    cols = [col[1] for col in c.fetchall()]
    if 'user_id' not in cols:
        c.execute("ALTER TABLE orders ADD COLUMN user_id INTEGER")
        
    c.execute('''
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        item_id INTEGER,
        name TEXT,
        price REAL,
        qty INTEGER,
        FOREIGN KEY(order_id) REFERENCES orders(id)
    )
    ''')
    c.execute('''
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        status TEXT,
        paid_at REAL,
        FOREIGN KEY(order_id) REFERENCES orders(id)
    )
    ''')
    c.execute('''
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        restaurant_id INTEGER,
        rating INTEGER,
        comment TEXT,
        created_at REAL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')
    conn.commit()
    conn.close()

init_db()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/restaurants')
def list_restaurants():
    return jsonify(restaurants)


@app.route('/api/restaurants/<int:r_id>/menu')
def get_menu(r_id):
    return jsonify(menus.get(r_id, []))


@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.json or {}
    customer = data.get('customer', {})
    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'items required'}), 400

    name = customer.get('name', '')
    phone = customer.get('phone', '')
    user_id = data.get('user_id')
    created = time.time()

    with order_lock:
        conn = get_conn()
        c = conn.cursor()
        c.execute('INSERT INTO orders (customer_name, customer_phone, status, created_at, user_id) VALUES (?,?,?,?,?)',
                  (name, phone, 'accepted', created, user_id))
        oid = c.lastrowid
        for it in items:
            c.execute('INSERT INTO items (order_id, item_id, name, price, qty) VALUES (?,?,?,?,?)',
                      (oid, it.get('id'), it.get('name'), it.get('price'), it.get('qty', 1)))
        conn.commit()
        conn.close()

    return jsonify({'order_id': oid}), 201


@app.route('/api/orders/<int:oid>')
def get_order(oid):
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT * FROM orders WHERE id=?', (oid,))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'not found'}), 404

    created = row['created_at']
    status = row['status']
    elapsed = time.time() - created
    new_status = status
    if elapsed > 20:
        new_status = 'delivered'
    elif elapsed > 10:
        new_status = 'out_for_delivery'
    elif elapsed > 2:
        new_status = 'preparing'

    if new_status != status:
        c.execute('UPDATE orders SET status=? WHERE id=?', (new_status, oid))
        conn.commit()

    c.execute('SELECT item_id, name, price, qty FROM items WHERE order_id=?', (oid,))
    items = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify({'id': oid, 'status': new_status, 'items': items})


@app.route('/api/users/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    phone = data.get('phone', '')
    if not username or not password:
        return jsonify({'error': 'username and password required'}), 400
    conn = get_conn()
    c = conn.cursor()
    try:
        ph = generate_password_hash(password)
        c.execute('INSERT INTO users (username, password_hash, phone) VALUES (?,?,?)', (username, ph, phone))
        conn.commit()
        uid = c.lastrowid
        conn.close()
        return jsonify({'user_id': uid, 'username': username}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'username exists'}), 400


@app.route('/api/users/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'username and password required'}), 400
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT id, password_hash, phone, is_admin FROM users WHERE username=?', (username,))
    row = c.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'invalid credentials'}), 400
    if not check_password_hash(row['password_hash'], password):
        return jsonify({'error': 'invalid credentials'}), 400
    return jsonify({
        'user_id': row['id'], 
        'username': username, 
        'phone': row['phone'], 
        'is_admin': row['is_admin']
    })


@app.route('/api/users/update', methods=['POST'])
def update_user():
    data = request.json or {}
    uid = data.get('user_id')
    phone = data.get('phone')
    if not uid or phone is None:
        return jsonify({'error': 'user_id and phone required'}), 400
    conn = get_conn()
    c = conn.cursor()
    c.execute('UPDATE users SET phone=? WHERE id=?', (phone, uid))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success', 'phone': phone})


@app.route('/api/users/<int:uid>/orders')
def user_orders(uid):
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT id, customer_name, customer_phone, status, created_at FROM orders WHERE user_id=? ORDER BY created_at DESC', (uid,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/admin/dashboard')
def admin_dashboard():
    # 简单的简单权限校验（实际应使用 token 校验）
    uid = request.args.get('user_id')
    if not uid:
        return jsonify({'error': 'unauthorized'}), 401
    
    conn = get_conn()
    c = conn.cursor()
    
    # 校验是否是管理员
    c.execute('SELECT is_admin FROM users WHERE id=?', (uid,))
    user = c.fetchone()
    if not user or not user['is_admin']:
        conn.close()
        return jsonify({'error': 'forbidden'}), 403
        
    c.execute('SELECT id, username, phone, is_admin FROM users')
    users = [dict(r) for r in c.fetchall()]
    
    c.execute('SELECT * FROM orders ORDER BY created_at DESC')
    orders = [dict(r) for r in c.fetchall()]
    
    conn.close()
    return jsonify({
        'users': users,
        'orders': orders
    })


@app.route('/api/admin/orders/status', methods=['POST'])
def update_order_status():
    data = request.json or {}
    oid = data.get('order_id')
    status = data.get('status')
    uid = data.get('user_id')
    
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT is_admin FROM users WHERE id=?', (uid,))
    user = c.fetchone()
    if not user or not user['is_admin']:
        conn.close()
        return jsonify({'error': 'forbidden'}), 403
        
    c.execute('UPDATE orders SET status=? WHERE id=?', (status, oid))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})


@app.route('/api/reviews', methods=['POST', 'GET'])
def manage_reviews():
    if request.method == 'POST':
        data = request.json
        conn = get_conn()
        c = conn.cursor()
        c.execute('INSERT INTO reviews (user_id, restaurant_id, rating, comment, created_at) VALUES (?,?,?,?,?)',
                  (data['user_id'], data['restaurant_id'], data['rating'], data['comment'], time.time()))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    else:
        rid = request.args.get('restaurant_id')
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT r.*, u.username FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.restaurant_id=? ORDER BY created_at DESC', (rid,))
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return jsonify(rows)


@app.route('/api/pay', methods=['POST'])
def pay():
    data = request.json or {}
    oid = data.get('order_id')
    if not oid:
        return jsonify({'error': 'order_id required'}), 400
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT id FROM orders WHERE id=?', (oid,))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'order not found'}), 404
    paid_at = time.time()
    c.execute('INSERT INTO payments (order_id, status, paid_at) VALUES (?,?,?)', (oid, 'paid', paid_at))
    c.execute('UPDATE orders SET status=? WHERE id=?', ('paid', oid))
    conn.commit()
    conn.close()
    return jsonify({'order_id': oid, 'status': 'paid'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
