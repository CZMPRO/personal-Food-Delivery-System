import sqlite3

def check_db():
    try:
        conn = sqlite3.connect('orders.db')
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print("Existing tables:", tables)
        
        for table in tables:
            name = table[0]
            cursor.execute(f"PRAGMA table_info({name});")
            cols = cursor.fetchall()
            print(f"Schema for {name}:", [c[1] for c in cols])
            
        conn.close()
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    check_db()
