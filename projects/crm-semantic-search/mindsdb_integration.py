import pandas as pd
import mysql.connector
import streamlit as st

# ✅ Connect to MindsDB MySQL interface
def get_connection():
    return mysql.connector.connect(
        host="127.0.0.1",
        port=47335,
        user="mindsdb",
        password="",
        database="mindsdb"
    )

# 🔍 Function to query MindsDB semantic model
def query_mindsdb_semantic(query_text):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Define an empty context (so MindsDB doesn't throw a KeyError)
        context = ""

        sql = f"""
        SELECT answer
        FROM crm_semantic_search
        WHERE query = "{query_text}"
        AND context = "{context}";
        """

        cursor.execute(sql)
        result = cursor.fetchall()

        if result:
            return result[0][0]
        else:
            return "Sorry, I couldn’t find a relevant answer in CRM knowledge base."

    except Exception as e:
        st.error(f"⚠️ MindsDB query failed: {e}")
        return None
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()
