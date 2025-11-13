import sqlite3
from sentence_transformers import SentenceTransformer

# DB Setup
conn = sqlite3.connect("crm_kb.db")
cursor = conn.cursor()

# Create table
cursor.execute("DROP TABLE IF EXISTS crm_embeddings")
cursor.execute("""
CREATE TABLE crm_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT,
    content TEXT,
    embedding TEXT
)
""")

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def add_item(entity_type, content):
    emb = model.encode(content).tolist()
    emb_str = ",".join(map(str, emb))

    cursor.execute(
        "INSERT INTO crm_embeddings (entity_type, content, embedding) VALUES (?, ?, ?)",
        (entity_type, content, emb_str)
    )

# Sample CRM dataset
data = [
    ("Lead", "John Doe contacted regarding pricing details for enterprise plan."),
    ("Ticket", "Customer reported login issues on web portal. Ticket escalated."),
    ("Opportunity", "Negotiation phase started for ACME Corp renewal deal."),
    ("Interaction", "Gave product demo showcasing new analytics dashboard feature."),
    ("Note", "Follow-up call scheduled with procurement team next week."),
    ("Ticket", "Refund delayed for invoice #2345, customer angry and waiting."),
]

for d in data:
    add_item(d[0], d[1])

conn.commit()
print("✅ SQLite CRM KB Initialized!")
print("📊 Rows inserted:", cursor.execute("SELECT COUNT(*) FROM crm_embeddings").fetchone()[0])
conn.close()
