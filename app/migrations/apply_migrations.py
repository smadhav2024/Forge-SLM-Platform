"""
Run once on startup (or manually) to add new columns without dropping tables.
Safe to run multiple times — each ALTER TABLE is guarded by a column existence check.
"""
import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal


async def apply():
    async with AsyncSessionLocal() as db:
        # Add is_uploaded column if it doesn't exist yet
        await db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='models' AND column_name='is_uploaded'
                ) THEN
                    ALTER TABLE models ADD COLUMN is_uploaded BOOLEAN NOT NULL DEFAULT FALSE;
                END IF;
            END$$;
        """))
        await db.commit()
        print("MIGRATION: is_uploaded column ensured on models table.")
        # Add settings column on users table to store serialized user preferences
        await db.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='users' AND column_name='settings'
                ) THEN
                    ALTER TABLE users ADD COLUMN settings TEXT;
                END IF;
            END$$;
        """))
        await db.commit()
        print("MIGRATION: settings column ensured on users table.")


if __name__ == "__main__":
    async with engine.begin() as conn:
        # Add new columns if they don't exist (Postgres supports IF NOT EXISTS)
        try:
            await conn.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS base_model_key VARCHAR;"))
            await conn.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS dataset_id INTEGER;"))
            await conn.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS worker_pid INTEGER;"))
            await conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false NOT NULL;"))
            print("Migrations applied: added base_model_key, dataset_id, worker_pid, pinned")
        except Exception as e:
            print("Migration failed:", e)

if __name__ == '__main__':
    asyncio.run(apply())
