import sqlite3

conn = sqlite3.connect("crm.db")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS crm_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    category TEXT,
    entity_type TEXT,
    status TEXT,
    created_at TEXT
)
""")

conn.commit()
conn.close()

print("✅ Database initialized with full schema!")
