import libsql_client
import logging

import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_client():
    url = config.TURSO_DATABASE_URL.replace("libsql://", "https://").replace("libsql+http://", "https://")
    return libsql_client.create_client_sync(
        url=url,
        auth_token=config.TURSO_AUTH_TOKEN
    )


def init_db() -> None:
    print("[DB] Initializing database...")
    try:
        with get_client() as client:
            client.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    phone TEXT PRIMARY KEY,
                    name TEXT,
                    timezone TEXT DEFAULT 'Asia/Kolkata',
                    created_at TEXT
                )
            """)
            client.execute("""
                CREATE TABLE IF NOT EXISTS reminders (
                    id TEXT PRIMARY KEY,
                    user_phone TEXT,
                    text TEXT,
                    trigger_time TEXT,
                    recurrence TEXT DEFAULT 'none',
                    status TEXT DEFAULT 'pending',
                    created_at TEXT
                )
            """)
            client.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_phone TEXT,
                    role TEXT,
                    content TEXT,
                    timestamp TEXT
                )
            """)
        print("[DB] Database initialized successfully")
    except Exception as e:
        logger.error(f"[DB] Error initializing database: {e}")
        raise


def get_user(phone: str):
    try:
        with get_client() as client:
            result = client.execute("SELECT * FROM users WHERE phone = ?", [phone])
            return result.rows[0] if result.rows else None
    except Exception as e:
        logger.error(f"[DB] Error getting user: {e}")
        return None


def upsert_user(phone: str, name: str | None = None, timezone: str = "Asia/Kolkata") -> None:
    try:
        with get_client() as client:
            client.execute("""
                INSERT INTO users (phone, name, timezone, created_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(phone) DO UPDATE SET name=excluded.name
            """, [phone, name])
        print(f"[DB] Upserted user: {phone}")
    except Exception as e:
        logger.error(f"[DB] Error upserting user: {e}")


def get_last_messages(phone: str, limit: int = 5):
    try:
        with get_client() as client:
            result = client.execute("""
                SELECT role, content FROM messages
                WHERE user_phone = ?
                ORDER BY timestamp DESC LIMIT ?
            """, [phone, limit])
            return list(reversed(result.rows)) if result.rows else []
    except Exception as e:
        logger.error(f"[DB] Error getting last messages: {e}")
        return []


def insert_message(user_phone: str, role: str, content: str) -> None:
    try:
        with get_client() as client:
            client.execute("""
                INSERT INTO messages (user_phone, role, content, timestamp)
                VALUES (?, ?, ?, datetime('now'))
            """, [user_phone, role, content])
    except Exception as e:
        logger.error(f"[DB] Error inserting message: {e}")


def insert_reminder(id: str, user_phone: str, text: str, trigger_time: str, 
                    recurrence: str = "none", status: str = "pending") -> None:
    try:
        with get_client() as client:
            client.execute("""
                INSERT INTO reminders 
                (id, user_phone, text, trigger_time, recurrence, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            """, [id, user_phone, text, trigger_time, recurrence, status])
        print(f"[DB] Inserted reminder: {id}")
    except Exception as e:
        logger.error(f"[DB] Error inserting reminder: {e}")


def get_pending_reminders(user_phone: str):
    try:
        with get_client() as client:
            result = client.execute("""
                SELECT * FROM reminders 
                WHERE user_phone = ? AND status = 'pending'
            """, [user_phone])
            return result.rows if result.rows else []
    except Exception as e:
        logger.error(f"[DB] Error getting pending reminders: {e}")
        return []


def get_all_pending_reminders():
    try:
        with get_client() as client:
            result = client.execute("""
                SELECT * FROM reminders WHERE status = 'pending'
            """)
            return result.rows if result.rows else []
    except Exception as e:
        logger.error(f"[DB] Error getting all pending reminders: {e}")
        return []


def update_reminder_status(id: str, status: str) -> None:
    try:
        with get_client() as client:
            client.execute("""
                UPDATE reminders SET status = ? WHERE id = ?
            """, [status, id])
        print(f"[DB] Updated reminder {id} status to {status}")
    except Exception as e:
        logger.error(f"[DB] Error updating reminder status: {e}")
