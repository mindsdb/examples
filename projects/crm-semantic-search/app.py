import streamlit as st
import pandas as pd
from rag_engine import search_crm, generate_response, insert_crm_data
from mindsdb_integration import query_mindsdb_semantic


st.set_page_config(page_title="CRM Semantic Search", layout="wide")
st.title("🔍 CRM Semantic Search App")
st.write("Ask anything about leads, tickets, opportunities, or interactions.")

# ✅ Sidebar - Upload CSV for CRM Data Ingestion
st.sidebar.header("📁 Upload CRM Data")
uploaded_file = st.sidebar.file_uploader("Upload CRM CSV", type=["csv"])

if uploaded_file:
    df = pd.read_csv(uploaded_file)

    required_cols = ['content', 'entity_type', 'status', 'created_at']
    if all(col in df.columns for col in required_cols):
        inserted = insert_crm_data(df)
        st.sidebar.success(f"✅ Uploaded & indexed {inserted} CRM records!")
    else:
        st.sidebar.error(f"❌ CSV must contain required columns: {required_cols}")

query = st.text_input("Enter your query:", placeholder="e.g., refund delayed")

# ✅ New Filters
entity_filter = st.selectbox("Filter by Type:", ["All", "Lead", "Ticket", "Opportunity", "Note", "Interaction"])
status_filter = st.selectbox("Filter by Status:", ["All", "Open", "Pending", "Closed"])

if st.button("Search"):
    if query.strip():
        results = search_crm(query, entity_filter, status_filter)

        st.subheader("📌 Top Results")
        if len(results) == 0:
            st.warning("No results found.")
        else:
            for r in results:
                with st.expander(f"✅ {r['title']}"):
                    st.write(f"Type: {r['entity_type']}")
                    st.write(f"Status: {r['status']}")
                    st.write(f"Score: {round(r['score'], 3)}")
                    st.write("📝 Full Content:")
                    st.write(r['content'])

        st.subheader("🤖 Suggested Reply (via MindsDB)")
mindsdb_answer = query_mindsdb_semantic(query)

if mindsdb_answer:
    st.info(mindsdb_answer)
else:
    st.warning("No AI-generated response found.")

