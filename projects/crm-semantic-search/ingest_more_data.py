import sqlite3
from datetime import datetime, timedelta

DB_PATH = "crm.db"
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# More synthetic CRM data
new_records = [
    ("Lead", "Enterprise plan inquiry", "ACME Corp requested bulk pricing details", "Open"),
    ("Lead", "Mobile app pricing request", "Customer asked about app feature costs", "Open"),
    ("Ticket", "Payment failure", "User reported repeated payment failures during checkout", "Pending"),
    ("Ticket", "Email notifications failing", "Customer not receiving OTP emails", "Open"),
    ("Ticket", "Account suspended", "Account mistakenly flagged and suspended", "Urgent"),
    ("Opportunity", "Add-on purchase deal", "Customer evaluating analytics add-ons", "Negotiation"),
    ("Opportunity", "Expansion renewal", "Customer wants to upgrade license count", "Negotiation"),
    ("Invoice", "Invoice correction request", "Wrong billing address needs correction", "Pending"),
    ("Invoice", "Tax calculation error", "Customer reported wrong GST applied", "Open"),
    ("Interaction", "Customer onboarding call", "Walkthrough for new HRMS features given", "Completed"),
]

today = datetime.now()

data_to_insert = []
for i, record in enumerate(new_records):
    entity_type, title, content, status = record
    created_at = (today - timedelta(days=i)).strftime("%Y-%m-%d")
    data_to_insert.append((entity_type, title, content, status, created_at))

cursor.executemany("""
INSERT INTO crm_embeddings(entity_type, title, content, status, created_at)
VALUES (?, ?, ?, ?, ?)
""", data_to_insert)

conn.commit()

print(f"✅ Added {len(new_records)} new CRM records!")
conn.close()
