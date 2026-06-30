import os
import aiofiles
import tempfile
from fastapi import APIRouter, UploadFile, BackgroundTasks, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models import Conversation, DocumentVector
from app.rag_worker import process_document_task
from app.auth_utils import get_current_user

router = APIRouter(prefix="/conversations", tags=["RAG Documents"])

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


async def _assert_conversation_ownership(
    conversation_id: int, user_id: int, db: AsyncSession
) -> Conversation:
    """Shared guard: fetch the conversation and verify it belongs to the caller."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conv.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    return conv


@router.get("/{conversation_id}/documents")
async def list_documents(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Return the distinct document chunks and uploaded filenames for a conversation."""
    await _assert_conversation_ownership(conversation_id, user_id, db)

    result = await db.execute(
        select(DocumentVector.id, DocumentVector.source_filename)
        .where(DocumentVector.conversation_id == conversation_id)
        .order_by(DocumentVector.id.asc())
    )
    rows = result.all()

    chunk_count = len(rows)
    filenames = list(dict.fromkeys(row.source_filename for row in rows if row.source_filename))

    return {
        "conversation_id": conversation_id,
        "chunk_count": chunk_count,
        "filenames": filenames,
        "has_documents": chunk_count > 0,
    }


@router.post("/{conversation_id}/documents")
async def upload_document(
    conversation_id: int,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    chunk_size: int = Query(default=500, ge=100, le=2000, description="Characters per chunk"),
    chunk_overlap: int = Query(default=50, ge=0, le=500, description="Overlap between chunks"),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    await _assert_conversation_ownership(conversation_id, user_id, db)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    # Read content first so we can enforce the size limit before writing to disk
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the 100 MB limit ({len(content) / (1024*1024):.1f} MB uploaded)."
        )

    # Clamp overlap to avoid degenerate chunking
    safe_overlap = min(chunk_overlap, chunk_size // 2)

    fd, file_path = tempfile.mkstemp(suffix=".bin", prefix="rag_")
    os.close(fd)

    async with aiofiles.open(file_path, "wb") as out_file:
        await out_file.write(content)

    background_tasks.add_task(
        process_document_task,
        conversation_id,
        file_path,
        file.filename,
        chunk_size,
        safe_overlap,
    )

    return {
        "status": "Accepted",
        "filename": file.filename,
        "chunk_size": chunk_size,
        "chunk_overlap": safe_overlap,
        "message": "Document successfully ingested and queued for vectorization.",
    }


@router.delete("/{conversation_id}/documents")
async def clear_documents(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Delete all RAG document vectors for a conversation (clear context)."""
    await _assert_conversation_ownership(conversation_id, user_id, db)

    await db.execute(
        delete(DocumentVector).where(DocumentVector.conversation_id == conversation_id)
    )
    await db.commit()

    return {"status": "cleared", "conversation_id": conversation_id}
