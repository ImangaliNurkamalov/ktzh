from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TelemetryRecord
from app.schemas.locomotive_ingress import (
    CommonTelemetryIngress,
    LocomotiveDieselIngress,
    LocomotiveElectricIngress,
)
from app.services.locomotive_transform import normalize_health_status


def _as_float(v: float | bool | str) -> float:
    if isinstance(v, bool):
        return float(v)
    if isinstance(v, (int, float)):
        return float(v)
    return float(v)


def _as_bool(v: float | bool | str) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    return str(v).lower() in ("1", "true", "yes", "on")


def common_to_record_fields(common: CommonTelemetryIngress) -> dict:
    return {
        "speed_actual": _as_float(common.speed_actual.value),
        "speed_target": _as_float(common.speed_target.value),
        "traction_force_kn": _as_float(common.traction_force_kn.value),
        "wheel_slip": _as_bool(common.wheel_slip.value),
        "tm_pressure": _as_float(common.brakes.tm_pressure.value),
        "gr_pressure": _as_float(common.brakes.gr_pressure.value),
        "tc_pressure": _as_float(common.brakes.tc_pressure.value),
        "bearings_max": _as_float(common.temperatures.bearings_max.value),
        "cabin_temp": _as_float(common.temperatures.cabin.value),
        "board_voltage": _as_float(common.board_voltage.value),
    }


async def persist_locomotive_ingress(
    session: AsyncSession,
    packet: LocomotiveDieselIngress | LocomotiveElectricIngress,
    raw_ingress_json: str,
    *,
    health_index: int,
    health_status_raw: str,
) -> TelemetryRecord:
    """
    Сохраняет каждую принятую запись. raw_payload — JSON как от локомотива (не контракт фронта).
    Скалярные поля — из уже провалидированного пакета (после фильтрации каналов).
    health_index / health_status_raw — с бэкенда (compute_health_from_ingress), не с борта.
    """
    common = packet.telemetry.common
    fields = common_to_record_fields(common)
    ts = packet.timestamp or datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    status = normalize_health_status(health_status_raw)

    record = TelemetryRecord(
        timestamp=ts,
        locomotive_id=packet.locomotive_id,
        locomotive_type=packet.type,
        lat=0.0,
        lng=0.0,
        health_score=health_index,
        health_status=status,
        raw_payload=raw_ingress_json,
        **fields,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record
