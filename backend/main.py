from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.auth import router as auth_router
from api.conversations import router as conv_router
from api.ws import router as ws_router
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CoderSathi API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173"), "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(conv_router)
app.include_router(ws_router)

@app.get("/")
async def root():
    return {"name": "CoderSathi API", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/models")
async def get_models():
    from agent.graph import AVAILABLE_MODELS, DEFAULT_MODEL
    import os
    return {
        "models": [{"id": k, **v} for k, v in AVAILABLE_MODELS.items()],
        "default": os.getenv("DEFAULT_MODEL", DEFAULT_MODEL),
    }
