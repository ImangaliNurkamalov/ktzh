from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/locomotive_twin"
    DATABASE_ECHO: bool = False

    #: 1 — один внутренний ingest (как раньше). N>1 — N параллельных POST /api/locomotive/telemetry (стресс).
    SIMULATOR_INGEST_BURST: int = 10
    #: Базовый URL для стресс-режима (тот же процесс uvicorn: 127.0.0.1 внутри контейнера).
    SIMULATOR_BASE_URL: str = "http://127.0.0.1:8000"

    #: Пустая строка — без очереди (обработка сразу в HTTP/WS).
    #: Локально с брокером: в .env задать, например,
    #:   RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672/
    #: Проверка UI (образ rabbitmq:management): http://localhost:15672 — логин guest/guest,
    #: очередь см. в RABBITMQ_TELEMETRY_QUEUE.
    RABBITMQ_URL: str = ""
    RABBITMQ_TELEMETRY_QUEUE: str = "locomotive.telemetry"
    RABBITMQ_PREFETCH: int = 10

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
