# ingest.py
import sqlite3
import json
from sentence_transformers import SentenceTransformer

DB_PATH = "crm.db"
TABLE_NAME = "crm_embeddings"
MODEL_NAME = "all-MiniLM-L6-v2"

SAMPLE_DATA = [
    ("Billing delayed for customer A", "Ticket", "Open", "2025-10-20", "Support"),
    ("Refund not processed", "Ticket", "Pending", "2025-10-18", "Support"),
    ("Pricing issue negotiation", "Opportunity", "Won", "2025-10-01", "Sales"),
]

def insert_data():
    print("🚀 Generating embeddings...")
    model = SentenceTransformer(MODEL_NAME)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    for content, etype, status, created, source in SAMPLE_DATA:
        embedding = model.encode(content).tolist()
        cur.execute(f"""
            INSERT INTO {TABLE_NAME} (content, entity_type, status, created_at, source, embedding)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (content, etype, status, created, source, sqlite3.Binary(json.dumps(embedding).encode("utf-8"))))

    conn.commit()
    conn.close()
    print("✅ Data inserted!")

if __name__ == "__main__":
    insert_data()
