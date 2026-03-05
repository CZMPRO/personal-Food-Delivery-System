import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'orders.db')

def migrate_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 检查 orders 表是否有 user_id 列
    cursor.execute("PRAGMA table_info(orders);")
    cols = [c[1] for c in cursor.fetchall()]
    if 'user_id' not in cols:
        print("Migrating orders table: adding user_id column")
        cursor.execute("ALTER TABLE orders ADD COLUMN user_id INTEGER;")
    
    # 确保 users 表存在（以防万一）
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT,
        phone TEXT
    )
    ''')
    
    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == '__main__':
    migrate_db()
