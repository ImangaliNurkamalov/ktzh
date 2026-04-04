import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api import dashboard, history, telemetry
from app.core import rabbitmq as rabbitmq_broker
from app.core.config import settings
from app.db.database import init_db
from app.services.simulator import run_simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await rabbitmq_broker.startup()
    rabbitmq_broker.start_consumer()
    sim_task = asyncio.create_task(run_simulator())
    yield
    sim_task.cancel()
    await rabbitmq_broker.shutdown()


app = FastAPI(
    title="Locomotive Digital Twin",
    version="0.1.0",
    description="MVP backend для цифрового двойника локомотива (TE33A / KZ8A)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry.router)
app.include_router(dashboard.router)
app.include_router(history.router)


@app.get("/health", tags=["system"])
async def healthcheck():
    return {"status": "ok"}


@app.post(
    "/debug/rabbit-test",
    tags=["debug"],
    summary="Одно тестовое сообщение в очередь телеметрии (проверка E2E)",
)
async def debug_rabbit_test() -> dict:
    if not rabbitmq_broker.enabled():
        raise HTTPException(
            status_code=503,
            detail="RabbitMQ выключен: задайте RABBITMQ_URL в .env",
        )
    payload = {
        "event": "rabbit_test",
        "source": "fastapi",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    raw = json.dumps(payload, ensure_ascii=False)
    await rabbitmq_broker.publish_telemetry_raw(raw)
    return {
        "status": "published",
        "queue": settings.RABBITMQ_TELEMETRY_QUEUE,
        "payload": payload,
    }
