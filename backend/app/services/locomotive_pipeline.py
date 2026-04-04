"""
Единый конвейер приёма телеметрии с борта: дедуп → фильтр → валидация (без health) →
расчёт health на бэкенде → live_store → WS → БД.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import ValidationError

from app.core.live_store import live_store
from app.core.ws_manager import dashboard_manager
from app.db.database import async_session_factory
from app.schemas.locomotive_ingress import LocomotiveDieselIngress, LocomotiveElectricIngress
from app.services.health_service import compute_health_from_ingress
from app.services.locomotive_persist import persist_locomotive_ingress
from app.services.locomotive_transform import to_frontend_payload
from app.services.signal_filter import filters

logger = logging.getLogger("locomotive_pipeline")


async def process_locomotive_ingress_raw(raw: str) -> dict[str, Any]:
    """
    Обрабатывает один JSON-пакет от борта (поле ``health`` не допускается).

    Returns:
        ``{"ok": True, "record_id": int}`` | ``{"ok": False, "reason": "duplicate"}`` |
        ``{"ok": False, "reason": "validation"}``
    """
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Invalid JSON in locomotive packet")
        return {"ok": False, "reason": "validation"}

    loco_id = data.get("locomotive_id", "")

    lf = filters.get(loco_id)
    if lf.is_duplicate(raw):
        return {"ok": False, "reason": "duplicate"}

    if "telemetry" in data:
        data["telemetry"] = lf.process_telemetry(data["telemetry"])

    loco_type = data.get("type", "diesel")
    try:
        if loco_type == "electric":
            packet: LocomotiveDieselIngress | LocomotiveElectricIngress = (
                LocomotiveElectricIngress.model_validate(data)
            )
        else:
            packet = LocomotiveDieselIngress.model_validate(data)
    except ValidationError as exc:
        logger.warning("Locomotive validation failed: %s", exc.error_count())
        return {"ok": False, "reason": "validation"}

    health = compute_health_from_ingress(packet)
    frontend = to_frontend_payload(packet, health)

    live_store.update(loco_id, frontend)
    await dashboard_manager.broadcast(frontend)

    async with async_session_factory() as session:
        record = await persist_locomotive_ingress(session, packet, raw, health)

    return {"ok": True, "record_id": record.id}
