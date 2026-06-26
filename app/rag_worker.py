import os
import fitz  # PyMuPDF
from fastembed import TextEmbedding
from docx import Document as DocxDocument
from app.database import AsyncSessionLocal
from app.models import DocumentVector

# Initialize the embedding model globally
embedding_model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50):
    """Splits text into precise fragments with overlapping windows."""
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
        
    return chunks

def extract_text(file_path: str) -> str:
    """Extracts text robustly by checking file signatures (magic bytes) instead of extensions."""
    raw_text = ""
    
    # Read the first 4 bytes to definitively identify the actual file format
    with open(file_path, "rb") as f:
        header = f.read(4)
        
    if header == b"%PDF":
        # It is definitively a PDF. Force it through PyMuPDF.
        doc = fitz.open(file_path)
        for page in doc:
            text = page.get_text("text")
            if text:
                raw_text += text + "\n"
        doc.close()
        
    elif header.startswith(b"PK"):
        # ZIP signature, which means it's a DOCX file.
        doc = DocxDocument(file_path)
        raw_text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        
    else:
        # Fallback to plain text
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            raw_text = f.read()

    # Clean any stray null bytes to protect PostgreSQL
    return raw_text.replace("\x00", "")

async def process_document_task(conversation_id: int, file_path: str, source_filename: str = ""):
    """Background worker that processes the document asynchronously."""
    try:
        content = extract_text(file_path)
        
        if not content.strip():
            print(f"SYSTEM WARNING: No text could be extracted from {file_path}")
            return

        text_chunks = chunk_text(content)
        embeddings = list(embedding_model.embed(text_chunks))

        async with AsyncSessionLocal() as db:
            for chunk, emb in zip(text_chunks, embeddings):
                doc_vec = DocumentVector(
                    conversation_id=conversation_id,
                    source_filename=source_filename or None,
                    text_chunk=chunk,
                    embedding_matrix=emb.tolist()
                )
                db.add(doc_vec)
            
            await db.commit()
            print(f"SYSTEM: Successfully embedded {len(text_chunks)} clean text chunks for Conv #{conversation_id}")
    
    except Exception as e:
        print(f"SYSTEM: RAG Worker Error on Conv #{conversation_id}: {str(e)}")
        
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
