import sqlite3
from sentence_transformers import SentenceTransformer

conn = sqlite3.connect("crm_kb.db")
cursor = conn.cursor()

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

messages = [
    ("Message", "Customer complained about late refund repeatedly in chat."),
    ("Message", "User requested support for password reset but got no reply."),
    ("Message", "Email about wrong pricing on the payment page."),
    ("Message", "Customer asked how to enable 2-factor authentication."),
    ("Message", "Chat note: User angry about product subscription cancellation."),
]

def add_message(entity_type, content):
    emb = model.encode(content).tolist()
    emb_str = ",".join(map(str, emb))
    cursor.execute(
        "INSERT INTO crm_embeddings (entity_type, content, embedding) VALUES (?, ?, ?)",
        (entity_type, content, emb_str)
    )

for m in messages:
    add_message(m[0], m[1])

conn.commit()
print("✅ Messages ingested successfully!")
print("📊 Total rows:", cursor.execute("SELECT COUNT(*) FROM crm_embeddings").fetchone()[0])
conn.close()
