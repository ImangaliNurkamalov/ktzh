"""
Фоновый симулятор телеметрии (сценарий 3 · KZ8A «Реальная угроза»).

Запускается при старте приложения.
Первые 30 тиков — штатный крейсерский режим (90 км/ч).
На 31-м тике происходит разрыв тормозного шланга:
  • tm_pressure резко падает 5.0 → 1.5
  • tc_pressure подскакивает 0.0 → 4.0 (экстренное торможение)
  • Тяга отключается, скорость падает до нуля

Стресс-режим (SIMULATOR_INGEST_BURST>1): за один логический тик шлётся N параллельных
HTTP POST на /api/locomotive/telemetry (по умолчанию N=10). Для обычной работы задайте
SIMULATOR_INGEST_BURST=1.
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core import rabbitmq as rabbitmq_broker
from app.core.config import settings
from app.core.live_store import live_store
from app.core.ws_manager import dashboard_manager

logger = logging.getLogger("simulator")

RUPTURE_TICK = 30
LOCOMOTIVE_ID = "KZ8A-0021"


def _drift(cur: float, tgt: float, noise: float, lo: float, hi: float) -> float:
    delta = random.uniform(-noise, noise)
    pull = (tgt - cur) * 0.08
    return round(max(lo, min(hi, cur + delta + pull)), 2)


def _approach(cur: float, tgt: float, rate: float) -> float:
    if abs(cur - tgt) <= rate:
        return round(tgt, 2)
    return round(cur + rate, 2) if cur < tgt else round(cur - rate, 2)


def _ch(value: Any, state: int = 0) -> dict:
    if isinstance(value, float):
        value = round(value, 2)
    return {"value": value, "state": state}


def _health_status(idx: int) -> str:
    if idx >= 85:
        return "norm"
    if idx >= 60:
        return "warning"
    return "critical"


class ScenarioState:
    """Сценарий 3 · KZ8A — обрыв тормозной магистрали."""

    def __init__(self) -> None:
        self.spd_tgt = 90.0
        self.spd = 90.0
        self.traction = 130.0
        self.tm = 5.1
        self.gr = 8.7
        self.tc = 0.0
        self.bearings = 60.0
        self.cabin = 22.0
        self.bv = 110.0
        self.cat_kv = 27.0
        self.traction_a = 220.0
        self.trans_t = 70.0
        self.hp = 95
        self.d_next = 150.0
        self.d_total = 350.0
        self._phase = "CRUISE"

    def tick(self, t: int) -> dict[str, Any]:
        if t <= RUPTURE_TICK:
            self._tick_cruise()
        elif self.spd > 0.5:
            self._tick_rupture()
        else:
            self._tick_standstill()

        km_s = self.spd / 3600
        self.d_next = max(0, round(self.d_next - km_s, 2))
        self.d_total = max(0, round(self.d_total - km_s, 2))
        eta = int(self.d_next / max(self.spd, 1) * 60)

        tm_state = 0
        if self.tm < 3.5:
            tm_state = 2 if self.tm < 2.0 else 1
        tc_state = 1 if self.tc > 2.5 else 0

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "locomotive_id": LOCOMOTIVE_ID,
            "type": "electric",
            "health": {"index": self.hp, "status": _health_status(self.hp)},
            "route_map": {
                "next_point": "Шу",
                "end_point": "Алматы",
                "distance_to_next_km": self.d_next,
                "eta_next_minutes": eta,
                "total_distance_left_km": self.d_total,
            },
            "telemetry": {
                "common": {
                    "speed_actual": _ch(self.spd),
                    "speed_target": _ch(self.spd_tgt),
                    "traction_force_kn": _ch(self.traction),
                    "wheel_slip": _ch(False),
                    "brakes": {
                        "tm_pressure": _ch(self.tm, tm_state),
                        "gr_pressure": _ch(self.gr),
                        "tc_pressure": _ch(self.tc, tc_state),
                    },
                    "temperatures": {
                        "bearings_max": _ch(self.bearings),
                        "cabin": _ch(self.cabin),
                    },
                    "board_voltage": _ch(self.bv),
                },
                "power_system": {
                    "catenary_voltage_kv": _ch(self.cat_kv),
                    "pantograph_status": _ch("raised"),
                    "traction_current_a": _ch(self.traction_a),
                    "transformer_temp": _ch(self.trans_t),
                },
            },
        }

    def _tick_cruise(self) -> None:
        self._phase = "CRUISE"
        self.spd = _drift(self.spd, self.spd_tgt, 1.5, 80, 100)
        self.traction = _drift(self.traction, 130, 15, 80, 180)
        self.tm = _drift(self.tm, 5.1, 0.05, 5.0, 5.2)
        self.gr = _drift(self.gr, 8.7, 0.1, 8.5, 9.0)
        self.tc = _drift(self.tc, 0.0, 0.02, 0.0, 0.1)
        self.bearings = _drift(self.bearings, 60.0, 0.5, 55, 65)
        self.cabin = _drift(self.cabin, 22.0, 0.2, 20, 24)
        self.bv = _drift(self.bv, 110, 0.3, 108, 112)
        self.cat_kv = _drift(self.cat_kv, 27.0, 0.1, 26.8, 27.2)
        self.traction_a = _drift(self.traction_a, 220, 15, 150, 300)
        self.trans_t = _drift(self.trans_t, 70, 0.8, 65, 75)
        self.hp = max(85, min(100, self.hp + random.randint(-1, 1)))

    def _tick_rupture(self) -> None:
        self._phase = "!! RUPTURE"
        self.tm = _approach(self.tm, 1.5, random.uniform(0.4, 0.6))
        self.tc = _approach(self.tc, 4.0, random.uniform(0.5, 0.7))
        self.gr = _drift(self.gr, 8.5, 0.1, 8.0, 9.0)
        self.traction = _approach(self.traction, 0, 25)
        self.traction_a = _approach(self.traction_a, 0, random.uniform(25, 40))
        self.cat_kv = _approach(self.cat_kv, 27.3, 0.1)
        self.trans_t = _approach(self.trans_t, 55, 0.5)
        self.spd = max(0, round(self.spd - random.uniform(2.0, 3.5), 2))
        self.bearings = _drift(self.bearings, 58, 0.5, 50, 70)
        self.cabin = _drift(self.cabin, 22.0, 0.2, 20, 24)
        self.bv = _drift(self.bv, 110, 0.5, 106, 114)
        self.hp = max(30, self.hp - random.randint(3, 6))

    def _tick_standstill(self) -> None:
        self._phase = "STOP"
        self.spd = 0.0
        self.traction = 0.0
        self.traction_a = _drift(self.traction_a, 30, 5, 0, 50)
        self.tm = _drift(self.tm, 1.5, 0.05, 1.0, 2.0)
        self.tc = _drift(self.tc, 4.0, 0.05, 3.5, 4.5)
        self.gr = _drift(self.gr, 8.5, 0.1, 8.0, 9.0)
        self.cat_kv = _drift(self.cat_kv, 27.3, 0.1, 27.0, 27.5)
        self.trans_t = _approach(self.trans_t, 45, 0.3)
        self.bearings = _approach(self.bearings, 30, 0.3)
        self.cabin = _drift(self.cabin, 22.0, 0.2, 20, 24)
        self.bv = _drift(self.bv, 110, 0.3, 108, 112)
        self.hp = max(30, min(50, self.hp + random.randint(-1, 0)))

    def log(self, _t: int) -> str:
        return (
            f"{self._phase:12s}  spd={self.spd:5.1f}  "
            f"tm={self.tm:.1f}  tc={self.tc:.1f}  "
            f"cur={self.traction_a:.0f}A  hp={self.hp}"
        )


_state: ScenarioState | None = None


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


def _payload_with_offset_ts(base: dict[str, Any], micro_offset: int) -> dict[str, Any]:
    """Копия пакета с уникальным timestamp (иначе дедуп по MD5 за 0.5 с отбросит дубликаты)."""
    p = copy.deepcopy(base)
    p["timestamp"] = (datetime.now(timezone.utc) + timedelta(microseconds=micro_offset)).isoformat()
    return p


async def _stress_ingest_burst(client: httpx.AsyncClient, base_payload: dict[str, Any], n: int) -> None:
    url = f"{settings.SIMULATOR_BASE_URL.rstrip('/')}/api/locomotive/telemetry"

    async def post_one(i: int) -> None:
        body = _payload_with_offset_ts(base_payload, i)
        r = await client.post(url, json=body)
        r.raise_for_status()

    await asyncio.gather(*(post_one(i) for i in range(n)))


async def run_simulator() -> None:
    global _state
    _state = ScenarioState()
    tick = 0
    burst = max(1, settings.SIMULATOR_INGEST_BURST)

    if burst > 1:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            while True:
                tick += 1
                payload = _state.tick(tick)
                logger.info("tick #%d | stress burst=%d | %s", tick, burst, _state.log(tick))
                try:
                    await _stress_ingest_burst(client, payload, burst)
                except Exception:
                    logger.exception("Stress ingest burst failed (tick %d)", tick)
                await asyncio.sleep(1.0)

    while True:
        tick += 1
        payload = _state.tick(tick)
        logger.info("tick #%d | %s", tick, _state.log(tick))
        if rabbitmq_broker.enabled():
            raw = json.dumps(payload, ensure_ascii=False, default=str)
            await rabbitmq_broker.publish_telemetry_raw(raw)
        else:
            live_store.update(LOCOMOTIVE_ID, payload)
            await dashboard_manager.broadcast(payload)
            await _persist_payload(payload)
        await asyncio.sleep(1.0)
