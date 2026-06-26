"""
Run once on startup (or manually) to add new columns without dropping tables.
Safe to run multiple times — each ALTER TABLE is guarded by a column existence check.
"""
import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def apply():
    async with AsyncSessionLocal() as db:
        try:
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
            print("MIGRATION: is_uploaded and settings columns ensured.")

            # Add new columns if they don't exist (Postgres supports IF NOT EXISTS)
            await db.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS base_model_key VARCHAR;"))
            await db.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS dataset_id INTEGER;"))
            await db.execute(text("ALTER TABLE models ADD COLUMN IF NOT EXISTS worker_pid INTEGER;"))
            await db.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false NOT NULL;"))
            await db.execute(text("ALTER TABLE document_vectors ADD COLUMN IF NOT EXISTS source_filename VARCHAR"))
            
            # Commit all changes at once
            await db.commit()
            print("Migrations applied: added base_model_key, dataset_id, worker_pid, pinned")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            await db.rollback()

if __name__ == '__main__':
    # This block only runs if you execute this file directly (e.g., `python apply_migrations.py`)
    asyncio.run(apply())