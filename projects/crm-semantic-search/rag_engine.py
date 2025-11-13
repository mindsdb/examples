import sqlite3
import json
import math
import ollama
import pandas as pd
from sentence_transformers import SentenceTransformer

DB_PATH = "crm.db"
TABLE_NAME = "crm_embeddings"

# Load embedding model
embed_model = SentenceTransformer("all-MiniLM-L6-v2")

# Ensure table exists
def create_table():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT,
            entity_type TEXT,
            status TEXT,
            created_at TEXT,
            embedding TEXT
        )
    """)
    conn.commit()
    conn.close()


def get_embedding(text):
    return embed_model.encode(text).tolist()


def cosine_similarity(v1, v2):
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0
    return dot / (norm1 * norm2)


def insert_crm_data(df: pd.DataFrame):
    create_table()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    count = 0
    for _, row in df.iterrows():
        content = str(row["content"])
        entity_type = str(row["entity_type"])
        status = str(row["status"])
        created_at = str(row["created_at"])

        embedding = json.dumps(get_embedding(content))

        cursor.execute(f"""
            INSERT INTO {TABLE_NAME} (content, entity_type, status, created_at, embedding)
            VALUES (?, ?, ?, ?, ?)
        """, (content, entity_type, status, created_at, embedding))

        count += 1

    conn.commit()
    conn.close()
    return count


def search_crm(query, entity_filter="All", status_filter="All", top_k=5):
    query_emb = get_embedding(query)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    filter_sql = ""
    params = []

    if entity_filter != "All":
        filter_sql += " AND entity_type = ?"
        params.append(entity_filter)

    if status_filter != "All":
        filter_sql += " AND status = ?"
        params.append(status_filter)

    cursor.execute(f"""
        SELECT id, content, entity_type, status, created_at, embedding
        FROM {TABLE_NAME}
        WHERE 1=1 {filter_sql}
    """, params)

    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        emb = json.loads(row[5])
        score = cosine_similarity(query_emb, emb)
        results.append({
            "id": row[0],
            "title": row[1][:50],  # Short preview
            "content": row[1],  # ✅ Full text for display
            "entity_type": row[2],
            "status": row[3],
            "created_at": row[4],
            "score": score
        })

    return sorted(results, key=lambda x: x["score"], reverse=True)[:top_k]


def generate_response(query, top_results):
    if not top_results:
        return "No relevant info found."

    context = ""
    for r in top_results:
        context += f"- {r['content']}\n"

    prompt = f"""
You are a helpful CRM AI assistant.

User Query:
{query}

Relevant CRM Data:
{context}

Write a concise helpful reply.
"""

    try:
        response = ollama.chat(
            model="llama3:8b",
            messages=[{"role": "user", "content": prompt}]
        )
        return response["message"]["content"]

    except Exception as e:
        return "⚠️ AI failed: " + str(e)
