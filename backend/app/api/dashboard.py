from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.live_store import live_store
from app.core.ws_manager import dashboard_manager
from app.db.database import get_session
from app.db.models import TelemetryRecord

router = APIRouter(tags=["dashboard"])


@router.get("/api/dashboard")
async def dashboard_live() -> dict[str, Any]:
    """
    Возвращает live-снимок локомотива из памяти. o
    Обновляется каждую секунду симулятором.
    """
    data = live_store.get("KZ8A-0021")
    if data is None:
        return {}
    return data


@router.get("/api/dashboard/current")
async def dashboard_current(
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Последняя запись по каждому locomotive_id из БД (fallback)."""
    from sqlalchemy import func

    subq = (
        select(
            TelemetryRecord.locomotive_id,
            func.max(TelemetryRecord.id).label("max_id"),
        )
        .group_by(TelemetryRecord.locomotive_id)
        .subquery()
    )

    stmt = select(TelemetryRecord).join(
        subq,
        TelemetryRecord.id == subq.c.max_id,
    )

    result = await session.execute(stmt)
    records = result.scalars().all()

    return [
        {
            "locomotive_id": r.locomotive_id,
            "locomotive_type": r.locomotive_type,
            "timestamp": r.timestamp.isoformat(),
            "speed_actual": r.speed_actual,
            "speed_target": r.speed_target,
            "traction_force_kn": r.traction_force_kn,
            "wheel_slip": r.wheel_slip,
            "coordinates": {"lat": r.lat, "lng": r.lng},
            "brakes": {
                "tm_pressure": r.tm_pressure,
                "gr_pressure": r.gr_pressure,
                "tc_pressure": r.tc_pressure,
            },
            "temperatures": {
                "bearings_max": r.bearings_max,
                "cabin": r.cabin_temp,
            },
            "board_voltage": r.board_voltage,
            "health_score": r.health_score,
            "health_status": r.health_status,
        }
        for r in records
    ]


@router.websocket("/ws/dashboard")
async def ws_dashboard(ws: WebSocket) -> None:
    """
    Фронт подключается сюда. Сразу получает текущий снимок,
    затем каждую секунду — свежие данные из live_store.
    Параллельно слушаем клиент, чтобы поймать disconnect.
    """
    await ws.accept()

    current = live_store.get("KZ8A-0021")
    if current:
        await ws.send_text(json.dumps(current, default=str, ensure_ascii=False))

    async def _reader() -> None:
        try:
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            pass

    reader_task = asyncio.create_task(_reader())
    try:
        while not reader_task.done():
            data = live_store.get("KZ8A-0021")
            if data:
                await ws.send_text(json.dumps(data, default=str, ensure_ascii=False))
            await asyncio.sleep(1)
    except Exception:
        pass
    finally:
        reader_task.cancel()
        try:
            await ws.close()
        except Exception:
            pass
