"""
In-memory хранилище последнего состояния каждого локомотива.
GET /api/dashboard читает из него — всегда актуальные данные без БД.
"""

from __future__ import annotations

import time
from typing import Any


class LiveStore:
    def __init__(self) -> None:
        self._state: dict[str, dict[str, Any]] = {}

    def update(self, locomotive_id: str, payload: dict[str, Any]) -> None:
        payload["_updated_at"] = time.time()
        self._state[locomotive_id] = payload

    def get_all(self) -> list[dict[str, Any]]:
        return list(self._state.values())

    def get(self, locomotive_id: str) -> dict[str, Any] | None:
        return self._state.get(locomotive_id)


live_store = LiveStore()
