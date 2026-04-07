import asyncio
import logging
import os

from contextlib import asynccontextmanager
from fastapi import FastAPI

import config
import database
import queue_worker
import scheduler
import webhook

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[APP] Starting up...")
    
    os.makedirs(os.path.dirname(config.DATABASE_PATH), exist_ok=True)
    print(f"[APP] Database path: {config.DATABASE_PATH}")
    
    database.init_db()
    print("[APP] Database initialized")
    
    scheduler.start_scheduler()
    print("[APP] Scheduler started")
    
    task = asyncio.create_task(queue_worker.queue_worker())
    print("[APP] Queue worker started")
    
    yield
    
    print("[APP] Shutting down...")
    scheduler.shutdown_scheduler()
    task.cancel()
    print("[APP] Shutdown complete")


app = FastAPI(title="WhatsApp Bot", lifespan=lifespan)

app.include_router(webhook.router)


@app.get("/")
async def root():
    return {"status": "ok", "message": "WhatsApp Bot is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
