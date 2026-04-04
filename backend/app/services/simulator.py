"""
Фоновый симулятор телеметрии. Запускается при старте приложения,
каждые 0,5 с генерирует реалистично дрейфующие данные для
электровоза KZ8A-0021 и обновляет live_store + рассылает по WS.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
from typing import Any

from app.core.live_store import live_store
from app.core.ws_manager import dashboard_manager

logger = logging.getLogger("simulator")


def _drift(current: float, target: float, step: float, lo: float, hi: float) -> float:
    delta = random.uniform(-step, step)
    pull = (target - current) * 0.05
    return round(max(lo, min(hi, current + delta + pull)), 2)


def _drift_int(current: int, target: int, step: int, lo: int, hi: int) -> int:
    delta = random.randint(-step, step)
    pull = round((target - current) * 0.05)
    return max(lo, min(hi, current + delta + pull))


LOCOMOTIVE_CFG: dict[str, Any] = {
    "locomotive_id": "KZ8A-0021",
    "type": "electric",
    "route": {
        "next_point": "Шу",
        "end_point": "Алматы",
        "distance_to_next_km": 150.0,
        "total_distance_left_km": 350.0,
    },
}


class LocoState:
    def __init__(self, cfg: dict[str, Any]) -> None:
        self.cfg = cfg
        self.speed_actual = 90.0
        self.speed_target = 90.0
        self.traction_force = 450.0
        self.tm_pressure = 5.0
        self.gr_pressure = 9.0
        self.tc_pressure = 0.0
        self.bearings_max = 58.4
        self.cabin = 21.5
        self.board_voltage = 110.0
        self.health_index = 95
        self.dist_next = cfg["route"]["distance_to_next_km"]
        self.dist_total = cfg["route"]["total_distance_left_km"]
        self.eta_next = int(self.dist_next / max(self.speed_actual, 1) * 60)
        self.catenary_kv = 27.2
        self.traction_current = 480.0
        self.transformer_temp = 75.0

    def tick(self) -> dict[str, Any]:
        self.speed_actual = _drift(self.speed_actual, self.speed_target, 2.0, 0, 160)
        self.traction_force = _drift(self.traction_force, 450, 10, 0, 800)
        self.tm_pressure = _drift(self.tm_pressure, 5.0, 0.15, 3.0, 7.0)
        self.gr_pressure = _drift(self.gr_pressure, 9.0, 0.1, 7.0, 10.0)
        self.tc_pressure = _drift(self.tc_pressure, 0.0, 0.05, 0.0, 3.0)
        self.bearings_max = _drift(self.bearings_max, 58.0, 0.5, 40.0, 90.0)
        self.cabin = _drift(self.cabin, 22.0, 0.2, 18.0, 30.0)
        self.board_voltage = _drift(self.board_voltage, 110.0, 0.5, 100, 120)

        km_per_sec = self.speed_actual / 3600
        self.dist_next = max(0, round(self.dist_next - km_per_sec, 2))
        self.dist_total = max(0, round(self.dist_total - km_per_sec, 2))
        self.eta_next = max(0, int(self.dist_next / max(self.speed_actual, 1) * 60))

        self.health_index = _drift_int(self.health_index, 92, 1, 60, 100)
        if self.health_index >= 85:
            status = "norm"
        elif self.health_index >= 60:
            status = "warning"
        else:
            status = "critical"

        self.catenary_kv = _drift(self.catenary_kv, 27.5, 0.3, 24.0, 30.0)
        self.traction_current = _drift(self.traction_current, 480, 15, 200, 700)
        self.transformer_temp = _drift(self.transformer_temp, 75, 0.8, 50, 100)

        return {
            "locomotive_id": self.cfg["locomotive_id"],
            "type": self.cfg["type"],
            "health": {"index": self.health_index, "status": status},
            "route_map": {
                "next_point": self.cfg["route"]["next_point"],
                "end_point": self.cfg["route"]["end_point"],
                "distance_to_next_km": self.dist_next,
                "eta_next_minutes": self.eta_next,
                "total_distance_left_km": self.dist_total,
            },
            "telemetry": {
                "common": {
                    "speed_actual": {"value": self.speed_actual, "state": 0},
                    "speed_target": {"value": self.speed_target, "state": 0},
                    "traction_force_kn": {"value": self.traction_force, "state": 0},
                    "wheel_slip": {"value": False, "state": 0},
                    "brakes": {
                        "tm_pressure": {"value": self.tm_pressure, "state": 0},
                        "gr_pressure": {"value": self.gr_pressure, "state": 0},
                        "tc_pressure": {"value": self.tc_pressure, "state": 0},
                    },
                    "temperatures": {
                        "bearings_max": {"value": self.bearings_max, "state": 0},
                        "cabin": {"value": self.cabin, "state": 0},
                    },
                    "board_voltage": {"value": self.board_voltage, "state": 0},
                },
                "power_system": {
                    "catenary_voltage_kv": {"value": self.catenary_kv, "state": 0},
                    "pantograph_status": {"value": "raised", "state": 0},
                    "traction_current_a": {"value": self.traction_current, "state": 0},
                    "transformer_temp": {"value": self.transformer_temp, "state": int(self.transformer_temp > 80)},
                },
            },
        }


_state: LocoState | None = None


async def _persist_payload(payload: dict[str, Any]) -> None:
    from app.db.database import async_session_factory
    from app.schemas.locomotive_ingress import LocomotiveElectricIngress
    from app.services.locomotive_persist import persist_locomotive_ingress

    try:
        raw_json = json.dumps(payload, ensure_ascii=False, default=str)
        packet = LocomotiveElectricIngress.model_validate(payload)
        async with async_session_factory() as session:
            await persist_locomotive_ingress(session, packet, raw_json)
    except Exception:
        logger.exception("Simulator persist failed")


async def run_simulator() -> None:
    global _state
    _state = LocoState(LOCOMOTIVE_CFG)

    while True:
        payload = _state.tick()
        live_store.update(LOCOMOTIVE_CFG["locomotive_id"], payload)
        await dashboard_manager.broadcast(payload)
        await _persist_payload(payload)
        await asyncio.sleep(0.5)
