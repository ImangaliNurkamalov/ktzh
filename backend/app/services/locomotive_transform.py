from __future__ import annotations

from typing import Any, Literal

from app.schemas.locomotive_ingress import LocomotiveDieselIngress, LocomotiveElectricIngress


def normalize_health_status(raw: str) -> Literal["norm", "warning", "critical"]:
    key = raw.strip().lower()
    if key in ("norm", "normal", "ok"):
        return "norm"
    if key in ("warning", "attention", "внимание"):
        return "warning"
    if key in ("critical", "alarm", "критично"):
        return "critical"
    return "norm"


def to_frontend_payload(
    packet: LocomotiveDieselIngress | LocomotiveElectricIngress,
) -> dict[str, Any]:
    """
    Урезает маршрут до полей UI, нормализует статус здоровья, телеметрию
    оставляет в том же виде { value, state }.
    """
    rm = packet.route_map
    return {
        "locomotive_id": packet.locomotive_id,
        "type": packet.type,
        "health": {
            "index": packet.health.index,
            "status": normalize_health_status(packet.health.status),
        },
        "route_map": {
            "next_point": rm.next_point,
            "end_point": rm.end_point,
            "distance_to_next_km": rm.distance_to_next_km,
            "eta_next_minutes": rm.eta_next_minutes,
            "total_distance_left_km": rm.total_distance_left_km,
        },
        "telemetry": packet.telemetry.model_dump(),
    }
