# migrate_add_metadata.py
import sqlite3
from datetime import datetime

DB = "crm_kb.db"
TABLE = "crm_embeddings"

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in cursor.fetchall()]
    return column in cols

def migrate():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # Add columns if they don't exist
    if not column_exists(cur, TABLE, "title"):
        cur.execute(f"ALTER TABLE {TABLE} ADD COLUMN title TEXT;")
        print("Added column: title")
    else:
        print("Column already exists: title")

    if not column_exists(cur, TABLE, "created_at"):
        cur.execute(f"ALTER TABLE {TABLE} ADD COLUMN created_at TEXT;")
        print("Added column: created_at")
    else:
        print("Column already exists: created_at")

    if not column_exists(cur, TABLE, "status"):
        cur.execute(f"ALTER TABLE {TABLE} ADD COLUMN status TEXT;")
        print("Added column: status")
    else:
        print("Column already exists: status")

    conn.commit()

    # Backfill values for existing rows
    cur.execute(f"SELECT id, entity_type, content, title, created_at, status FROM {TABLE}")
    rows = cur.fetchall()

    today = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")  # ISO-ish UTC timestamp

    updated = 0
    for r in rows:
        row_id = r[0]
        entity_type = r[1] if len(r) > 1 else None
        content = r[2] if len(r) > 2 else ""
        title_existing = r[3] if len(r) > 3 else None
        created_existing = r[4] if len(r) > 4 else None
        status_existing = r[5] if len(r) > 5 else None

        title = title_existing if title_existing else (content[:80] + ("..." if len(content) > 80 else ""))
        created_at = created_existing if created_existing else today
        if status_existing and status_existing.strip():
            status = status_existing
        else:
            status = "open" if (entity_type and entity_type.lower() == "ticket") else "n/a"

        cur.execute(f"""
            UPDATE {TABLE}
            SET title = ?, created_at = ?, status = ?
            WHERE id = ?
        """, (title, created_at, status, row_id))
        updated += 1

    conn.commit()
    conn.close()

    print(f"Backfilled {updated} rows with title/created_at/status.")
    # Show a quick summary
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {TABLE}")
    total = cur.fetchone()[0]
    cur.execute(f"SELECT COUNT(DISTINCT status) FROM {TABLE}")
    distinct_status = cur.fetchone()[0]
    conn.close()
    print(f"Table {TABLE} total rows: {total} | distinct status values: {distinct_status}")

if __name__ == "__main__":
    migrate()
