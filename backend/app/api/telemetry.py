from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rabbitmq as rabbitmq_broker
from app.core.live_store import live_store
from app.core.ws_manager import dashboard_manager
from app.db.database import get_session
from app.db.models import AlertRecord, TelemetryRecord
from app.schemas.locomotive_ingress import (
    LocomotiveDieselIngress,
    LocomotiveElectricIngress,
)
from app.schemas.telemetry import TelemetryPacket
from app.services.health_service import compute_health
from app.services.locomotive_persist import persist_locomotive_ingress
from app.services.locomotive_transform import to_frontend_payload
from app.services.processing_service import build_dashboard_payload
from app.services.signal_filter import filters

logger = logging.getLogger("telemetry")

router = APIRouter(prefix="/api", tags=["telemetry"])


# ── WebSocket-приём телеметрии от локомотива ─────────────────────

@router.websocket("/ws/locomotive")
async def ws_locomotive(ws: WebSocket) -> None:
    """
    Борт подключается сюда и шлёт JSON-пакеты.
    При включённом RABBITMQ_URL пакет кладётся в очередь `locomotive.telemetry`;
    иначе сразу: дедубликация → фильтры → transform → live_store + WS + БД.
    """
    await ws.accept()
    logger.info("Locomotive WS connected")
    try:
        while True:
            raw = await ws.receive_text()
            try:
                if rabbitmq_broker.enabled():
                    await rabbitmq_broker.publish_telemetry_raw(raw)
                else:
                    await _process_raw_packet(raw)
            except Exception:
                logger.exception("Error processing locomotive packet")
    except WebSocketDisconnect:
        logger.info("Locomotive WS disconnected")
    except Exception:
        logger.exception("Locomotive WS error")


async def _process_raw_packet(raw: str) -> None:
    """Общая логика обработки одного JSON-пакета от борта."""
    data = json.loads(raw)
    loco_id = data.get("locomotive_id", "")

    lf = filters.get(loco_id)
    if lf.is_duplicate(raw):
        return

    if "telemetry" in data:
        data["telemetry"] = lf.process_telemetry(data["telemetry"])

    loco_type = data.get("type", "diesel")
    try:
        if loco_type == "electric":
            packet = LocomotiveElectricIngress.model_validate(data)
        else:
            packet = LocomotiveDieselIngress.model_validate(data)
    except ValidationError as exc:
        logger.warning("Validation failed: %s", exc.error_count())
        return

    frontend = to_frontend_payload(packet)

    live_store.update(loco_id, frontend)

    await dashboard_manager.broadcast(frontend)

    from app.db.database import async_session_factory
    async with async_session_factory() as session:
        await persist_locomotive_ingress(session, packet, raw)


# ── REST-приём (оставлен для совместимости / тестирования) ────────

@router.post(
    "/locomotive/telemetry",
    summary="Телеметрия от борта; при RabbitMQ — в очередь (ответ queued), иначе сразу в БД",
)
async def ingest_locomotive_telemetry(
    packet: LocomotiveDieselIngress | LocomotiveElectricIngress,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    raw_ingress_json = packet.model_dump_json()
    lf = filters.get(packet.locomotive_id)

    if lf.is_duplicate(raw_ingress_json):
        return {"status": "duplicate"}

    if rabbitmq_broker.enabled():
        await rabbitmq_broker.publish_telemetry_raw(raw_ingress_json)
        return {"status": "queued"}

    telemetry_dict = packet.telemetry.model_dump()
    filtered_telemetry = lf.process_telemetry(telemetry_dict)

    data = packet.model_dump()
    data["telemetry"] = filtered_telemetry

    loco_type = data.get("type", "diesel")
    if loco_type == "electric":
        packet = LocomotiveElectricIngress.model_validate(data)
    else:
        packet = LocomotiveDieselIngress.model_validate(data)

    frontend = to_frontend_payload(packet)
    live_store.update(packet.locomotive_id, frontend)
    record = await persist_locomotive_ingress(session, packet, raw_ingress_json)
    await dashboard_manager.broadcast(frontend)
    return {"status": "ok", "record_id": record.id}


@router.post("/telemetry")
async def ingest_telemetry(
    packet: TelemetryPacket,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    health = compute_health(packet)
    common = packet.telemetry.common

    record = TelemetryRecord(
        timestamp=packet.timestamp,
        locomotive_id=packet.locomotive_id,
        locomotive_type=packet.type,
        speed_actual=common.speed_actual,
        speed_target=common.speed_target,
        traction_force_kn=common.traction_force_kn,
        wheel_slip=common.wheel_slip,
        lat=common.coordinates.lat,
        lng=common.coordinates.lng,
        tm_pressure=common.brakes.tm_pressure,
        gr_pressure=common.brakes.gr_pressure,
        tc_pressure=common.brakes.tc_pressure,
        bearings_max=common.temperatures.bearings_max,
        cabin_temp=common.temperatures.cabin,
        board_voltage=common.board_voltage,
        health_score=health.score,
        health_status=health.status,
        raw_payload=json.dumps(packet.model_dump(), default=str),
    )
    session.add(record)
    await session.flush()

    for a in packet.alerts:
        session.add(
            AlertRecord(
                telemetry_record_id=record.id,
                alert_id=a.id,
                level=a.level,
                message=a.message,
                value=str(a.value) if a.value is not None else None,
            )
        )

    await session.commit()

    dashboard_msg = build_dashboard_payload(packet)
    await dashboard_manager.broadcast(dashboard_msg)

    return {
        "status": "ok",
        "record_id": record.id,
        "health_score": health.score,
        "health_status": health.status,
        "top_factors": [f.model_dump() for f in health.top_factors],
    }
