from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Model

# Assuming this lives in your training.py or config, import it here
SUPPORTED_MODELS = {
    "tinyllama": {"display_name": "Base: TinyLlama 1.1B", "gguf_path": "storage/models/tinyllama.gguf"},
    # Add phi2, llama3, etc., here later
}

async def seed_system_models():
    """Injects base models into the database as global system resources."""
    async with AsyncSessionLocal() as db:
        for key, config in SUPPORTED_MODELS.items():
            # Check if this exact base model is already registered
            stmt = select(Model).where(
                Model.display_name == config["display_name"], 
                Model.is_base_model == True
            )
            result = await db.execute(stmt)
            existing_model = result.scalars().first()

            if not existing_model:
                system_model = Model(
                    user_id=None, # Owned by the system!
                    display_name=config["display_name"],
                    base_model_path=config["gguf_path"],
                    status="READY", # Base models are instantly ready to chat
                    is_base_model=True
                )
                db.add(system_model)
                print(f"SYSTEM: Registered base model -> {config['display_name']}")
                
        await db.commit()
