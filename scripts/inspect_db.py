import sqlite3
import json
import os

DB = os.path.join(os.path.dirname(__file__), '..', 'orders.db')

def main():
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute('SELECT id, customer_name, customer_phone, status, created_at FROM orders')
    orders = [dict(zip([d[0] for d in c.description], row)) for row in c.fetchall()]
    c.execute('SELECT order_id, item_id, name, price, qty FROM items')
    items = [dict(zip([d[0] for d in c.description], row)) for row in c.fetchall()]
    conn.close()
    print(json.dumps({'orders': orders, 'items': items}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
