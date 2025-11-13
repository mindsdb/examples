# config.py
import os

# SQLite DB file path
DB_PATH = os.path.join(os.path.dirname(__file__), "crm_kb.db")

# Embedding Model
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Table name for KB storage
TABLE_NAME = "crm_embeddings"

# Default top-k results for search
TOP_K = 5

# Print current configuration (optional debug)
if __name__ == "__main__":
    print("Database:", DB_PATH)
    print("Embedding Model:", EMBEDDING_MODEL)
