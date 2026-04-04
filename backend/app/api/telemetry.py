from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect

from app.services.locomotive_pipeline import process_locomotive_ingress_raw

logger = logging.getLogger("telemetry")

router = APIRouter(prefix="/api", tags=["telemetry"])


# ── WebSocket-приём телеметрии от локомотива ─────────────────────

@router.websocket("/ws/locomotive")
async def ws_locomotive(ws: WebSocket) -> None:
    """
    Борт подключается сюда и шлёт JSON-пакеты (без поля ``health``).
    Обработка: ``locomotive_pipeline.process_locomotive_ingress_raw``.
    """
    await ws.accept()
    logger.info("Locomotive WS connected")
    try:
        while True:
            raw = await ws.receive_text()
            try:
                await process_locomotive_ingress_raw(raw)
            except Exception:
                logger.exception("Error processing locomotive packet")
    except WebSocketDisconnect:
        logger.info("Locomotive WS disconnected")
    except Exception:
        logger.exception("Locomotive WS error")


# ── REST-приём (сырой JSON как у WS) ─────────────────────────────

@router.post(
    "/locomotive/telemetry",
    summary="Телеметрия от борта (JSON без health) → тот же конвейер, что WS",
)
async def ingest_locomotive_telemetry(request: Request) -> dict[str, Any]:
    raw = (await request.body()).decode("utf-8")
    outcome = await process_locomotive_ingress_raw(raw)
    if outcome.get("ok"):
        return {"status": "ok", "record_id": outcome["record_id"]}
    reason = outcome.get("reason", "unknown")
    if reason == "duplicate":
        return {"status": "duplicate"}
    return {"status": "error", "reason": reason}
