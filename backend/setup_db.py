"""Run once to create the codersathi database and all tables."""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_database():
    conn = psycopg2.connect(
        host="localhost", port=5432,
        user="postgres", password="tushar123",
        database="postgres"
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname='codersathi'")
    if not cur.fetchone():
        cur.execute("CREATE DATABASE codersathi")
        print("[OK] Database 'codersathi' created")
    else:
        print("[OK] Database 'codersathi' already exists")
    cur.close()
    conn.close()

    # Now create tables
    conn2 = psycopg2.connect(
        host="localhost", port=5432,
        user="postgres", password="tushar123",
        database="codersathi"
    )
    cur2 = conn2.cursor()
    cur2.execute("CREATE EXTENSION IF NOT EXISTS vector")
    cur2.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur2.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id VARCHAR(36) PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) DEFAULT 'New Chat',
            workspace_path VARCHAR(500),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur2.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            conversation_id VARCHAR(36) REFERENCES conversations(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL,
            content TEXT,
            tool_calls JSONB,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur2.execute("""
        CREATE TABLE IF NOT EXISTS tool_permissions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            tool_name VARCHAR(100) NOT NULL,
            permission VARCHAR(20) DEFAULT 'ask',
            UNIQUE(user_id, tool_name)
        )
    """)
    conn2.commit()
    cur2.close()
    conn2.close()
    print("[OK] All tables created successfully")

if __name__ == "__main__":
    create_database()
