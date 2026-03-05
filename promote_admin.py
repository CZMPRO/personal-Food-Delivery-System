import sqlite3
import os

DB = os.path.join(os.path.dirname(__file__), 'orders.db')

def promote(username):
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute('UPDATE users SET is_admin=1 WHERE username=?', (username,))
    if c.rowcount > 0:
        print(f"成功将用户 '{username}' 提升为管理员！")
    else:
        print(f"找不到用户 '{username}'，请确保该用户已注册。")
    conn.commit()
    conn.close()

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("用法: python promote_admin.py <用户名>")
    else:
        promote(sys.argv[1])
