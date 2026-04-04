from __future__ import annotations

from typing import Any

from app.schemas.telemetry import DieselTelemetryPacket, ElectricTelemetryPacket
from app.services.health_service import compute_health


def build_dashboard_payload(
    packet: DieselTelemetryPacket | ElectricTelemetryPacket,
) -> dict[str, Any]:
    """
    Принимает валидный пакет телеметрии, вычисляет health и возвращает
    enriched payload, готовый для отправки через WebSocket / API.

    Точка расширения: здесь можно добавить smoothing, аномалии и т.д.
    """
    health = compute_health(packet)
    common = packet.telemetry.common

    return {
        "type": "dashboard_update",
        "payload": {
            "timestamp": packet.timestamp.isoformat(),
            "locomotive_id": packet.locomotive_id,
            "locomotive_type": packet.type,
            "health_score": health.score,
            "health_status": health.status,
            "speed_actual": common.speed_actual,
            "speed_target": common.speed_target,
            "traction_force_kn": common.traction_force_kn,
            "wheel_slip": common.wheel_slip,
            "coordinates": {
                "lat": common.coordinates.lat,
                "lng": common.coordinates.lng,
            },
            "brakes": {
                "tm_pressure": common.brakes.tm_pressure,
                "gr_pressure": common.brakes.gr_pressure,
                "tc_pressure": common.brakes.tc_pressure,
            },
            "temperatures": {
                "bearings_max": common.temperatures.bearings_max,
                "cabin": common.temperatures.cabin,
            },
            "board_voltage": common.board_voltage,
            "top_factors": [f.model_dump() for f in health.top_factors],
            "alerts": [a.model_dump() for a in packet.alerts],
        },
    }
