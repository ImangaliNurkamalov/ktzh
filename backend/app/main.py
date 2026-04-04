import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import dashboard, history, telemetry
from app.db.database import init_db
from app.services.simulator import run_simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    sim_task = asyncio.create_task(run_simulator())
    yield
    sim_task.cancel()


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
