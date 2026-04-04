"""
Фоновый цикл телеметрии при старте приложения.

Данные берутся из ``scripts/scenario3_kz8a.State``; обработка — через
``locomotive_pipeline.process_locomotive_ingress_raw`` (тот же путь, что и для WebSocket-борта).
"""

from __future__ import annotations

import asyncio
import importlib
import json
import logging

logger = logging.getLogger("simulator")

TICK_SEC = 1.0


async def run_simulator() -> None:
    scenario_mod = importlib.import_module("scripts.scenario3_kz8a")
    State = scenario_mod.State
    pipeline = importlib.import_module("app.services.locomotive_pipeline")
    process_raw = pipeline.process_locomotive_ingress_raw

    state = State()
    t = 0
    logger.info(
        "Background telemetry: scripts.scenario3_kz8a.State, %.1f s/tick",
        TICK_SEC,
    )
    try:
        while True:
            t += 1
            payload = state.tick(t)
            raw = json.dumps(payload, ensure_ascii=False, default=str)
            await process_raw(raw)
            await asyncio.sleep(TICK_SEC)
    except asyncio.CancelledError:
        logger.info("Background telemetry cancelled")
        raise
