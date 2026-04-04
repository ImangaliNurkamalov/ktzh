"""
Фильтрация телеметрии: EMA-сглаживание, медианный фильтр,
дедубликация пакетов, валидация state-кодов.
"""

from __future__ import annotations

import hashlib
import json
import statistics
import time
from collections import deque
from typing import Any


# ── Допустимые диапазоны для числовых параметров ──────────────────
VALID_RANGES: dict[str, tuple[float, float]] = {
    "speed_actual": (0, 300),
    "speed_target": (0, 300),
    "traction_force_kn": (0, 2000),
    "tm_pressure": (0, 20),
    "gr_pressure": (0, 20),
    "tc_pressure": (0, 20),
    "bearings_max": (-50, 200),
    "cabin": (-50, 80),
    "board_voltage": (0, 500),
    "diesel_rpm": (0, 3000),
    "fuel_level_percent": (0, 100),
    "fuel_consumption_lh": (0, 1000),
    "oil_pressure": (0, 20),
    "oil_temp": (-50, 200),
    "coolant_temp": (-50, 200),
    "catenary_voltage_kv": (0, 50),
    "traction_current_a": (0, 2000),
    "transformer_temp": (-50, 200),
}

EMA_ALPHA = 0.3
MEDIAN_WINDOW = 5
DEDUP_TTL_SEC = 0.5


class LocomotiveFilter:
    """Фильтр для одного локомотива (хранит историю каналов)."""

    def __init__(self) -> None:
        self._ema: dict[str, float] = {}
        self._median_buf: dict[str, deque[float]] = {}
        self._last_hash: str | None = None
        self._last_hash_ts: float = 0.0

    # ── Дедубликация ──────────────────────────────────────────────

    def is_duplicate(self, raw_json: str) -> bool:
        h = hashlib.md5(raw_json.encode(), usedforsecurity=False).hexdigest()
        now = time.monotonic()
        if h == self._last_hash and (now - self._last_hash_ts) < DEDUP_TTL_SEC:
            return True
        self._last_hash = h
        self._last_hash_ts = now
        return False

    # ── Валидация state ───────────────────────────────────────────

    @staticmethod
    def validate_state(channel: dict) -> bool:
        """state == 2 → датчик неисправен, отбрасываем значение."""
        return channel.get("state", 0) != 2

    # ── Валидация диапазона ────────────────────────────────────────

    @staticmethod
    def in_range(key: str, value: float) -> bool:
        bounds = VALID_RANGES.get(key)
        if bounds is None:
            return True
        return bounds[0] <= value <= bounds[1]

    # ── EMA ────────────────────────────────────────────────────────

    def ema(self, key: str, raw: float) -> float:
        prev = self._ema.get(key)
        if prev is None:
            self._ema[key] = raw
            return raw
        smoothed = EMA_ALPHA * raw + (1 - EMA_ALPHA) * prev
        self._ema[key] = smoothed
        return round(smoothed, 4)

    # ── Медианный фильтр ──────────────────────────────────────────

    def median(self, key: str, raw: float) -> float:
        buf = self._median_buf.setdefault(key, deque(maxlen=MEDIAN_WINDOW))
        buf.append(raw)
        return round(statistics.median(buf), 4)

    # ── Комбинированная фильтрация канала ─────────────────────────

    def smooth(self, key: str, raw: float) -> float:
        med = self.median(key, raw)
        return self.ema(key, med)

    # ── Обработка всего пакета ────────────────────────────────────

    def process_telemetry(self, telemetry: dict[str, Any]) -> dict[str, Any]:
        """
        Рекурсивно обходит telemetry-дерево, для каждого канала { value, state }
        проверяет state/диапазон и применяет smooth.  Возвращает очищенную копию.
        """
        return self._walk("", telemetry)

    def _walk(self, prefix: str, node: Any) -> Any:
        if isinstance(node, dict) and "value" in node and "state" in node:
            return self._filter_channel(prefix, node)
        if isinstance(node, dict):
            return {
                k: self._walk(f"{prefix}.{k}" if prefix else k, v)
                for k, v in node.items()
            }
        return node

    def _filter_channel(self, key: str, ch: dict) -> dict:
        short_key = key.rsplit(".", 1)[-1] if "." in key else key
        if not self.validate_state(ch):
            prev = self._ema.get(short_key, ch["value"])
            return {"value": prev, "state": ch["state"]}

        val = ch["value"]
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            if not self.in_range(short_key, val):
                prev = self._ema.get(short_key, val)
                return {"value": prev, "state": ch["state"]}
            val = self.smooth(short_key, val)
        return {"value": val, "state": ch["state"]}


class FilterRegistry:
    """Реестр фильтров — по одному на locomotive_id."""

    def __init__(self) -> None:
        self._filters: dict[str, LocomotiveFilter] = {}

    def get(self, locomotive_id: str) -> LocomotiveFilter:
        if locomotive_id not in self._filters:
            self._filters[locomotive_id] = LocomotiveFilter()
        return self._filters[locomotive_id]


filters = FilterRegistry()
