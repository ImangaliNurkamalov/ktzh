"""
Сценарий 1 · «Борьба с призраками» — TE33A (Дизельный локомотив)

Локомотив едет на крейсерской скорости (80 км/ч).
Раз в ~14 секунд датчик oil_temp или speed_actual выдаёт одиночную
«иглу» — значение подскакивает на 1 тик и возвращается обратно.

Бэкенд должен отфильтровать спайки (медиана + EMA) и НЕ генерировать
ложных алертов.
"""

from __future__ import annotations

import asyncio
import random

from _base import drift, ch, run

SPIKE_PROBABILITY = 0.07  # ~7 % → в среднем 1 спайк каждые ≈14 тиков


class State:
    def __init__(self) -> None:
        # --- cruising targets (Mode 3) ---
        self.spd_tgt = 80.0
        self.spd = 80.0
        self.traction = 100.0
        self.tm = 5.1
        self.gr = 8.7
        self.tc = 0.0
        self.bearings = 60.0
        self.cabin = 22.0
        self.bv = 110.0
        self.rpm = 600.0
        self.fuel_pct = round(random.uniform(70, 90), 2)
        self.fuel_cons = 100.0
        self.oil_p = 3.5
        self.oil_t = 84.0
        self.cool_t = 84.0
        self.d_next = 125.0
        self.d_total = 925.0
        self._spike_msg = ""

    def tick(self, t: int) -> dict:
        self.spd = drift(self.spd, self.spd_tgt, 1.5, 70, 90)
        self.traction = drift(self.traction, 100, 15, 50, 150)
        self.tm = drift(self.tm, 5.1, 0.05, 5.0, 5.2)
        self.gr = drift(self.gr, 8.7, 0.1, 8.5, 9.0)
        self.tc = drift(self.tc, 0.0, 0.02, 0.0, 0.1)
        self.bearings = drift(self.bearings, 60.0, 0.5, 55, 65)
        self.cabin = drift(self.cabin, 22.0, 0.2, 20, 24)
        self.bv = drift(self.bv, 110, 0.3, 108, 112)
        self.rpm = drift(self.rpm, 600, 20, 500, 700)
        self.fuel_cons = drift(self.fuel_cons, 100, 5, 80, 120)
        self.oil_p = drift(self.oil_p, 3.5, 0.1, 3.0, 4.0)
        self.oil_t = drift(self.oil_t, 84, 0.5, 80, 88)
        self.cool_t = drift(self.cool_t, 84, 0.5, 80, 88)

        km_s = self.spd / 3600
        self.d_next = max(0, round(self.d_next - km_s, 2))
        self.d_total = max(0, round(self.d_total - km_s, 2))
        self.fuel_pct = max(0, round(self.fuel_pct - self.fuel_cons / 3600, 2))
        eta = int(self.d_next / max(self.spd, 1) * 60)

        spd_raw = self.spd
        oil_t_raw = self.oil_t
        self._spike_msg = ""

        if random.random() < SPIKE_PROBABILITY:
            if random.random() < 0.5:
                spd_raw = round(random.uniform(180, 250), 2)
                self._spike_msg = f"SPIKE speed -> {spd_raw}"
            else:
                oil_t_raw = round(random.uniform(180, 250), 2)
                self._spike_msg = f"SPIKE oil_temp -> {oil_t_raw}"

        return {
            "locomotive_id": "TE33A-0154",
            "type": "diesel",
            "route_map": {
                "next_point": "Караганда",
                "end_point": "Алматы",
                "distance_to_next_km": self.d_next,
                "eta_next_minutes": eta,
                "total_distance_left_km": self.d_total,
            },
            "telemetry": {
                "common": {
                    "speed_actual": ch(spd_raw),
                    "speed_target": ch(self.spd_tgt),
                    "traction_force_kn": ch(self.traction),
                    "wheel_slip": ch(False),
                    "brakes": {
                        "tm_pressure": ch(self.tm),
                        "gr_pressure": ch(self.gr),
                        "tc_pressure": ch(self.tc),
                    },
                    "temperatures": {
                        "bearings_max": ch(self.bearings),
                        "cabin": ch(self.cabin),
                    },
                    "board_voltage": ch(self.bv),
                },
                "power_system": {
                    "diesel_rpm": ch(self.rpm),
                    "fuel_level_percent": ch(self.fuel_pct),
                    "fuel_consumption_lh": ch(self.fuel_cons),
                    "oil_pressure": ch(self.oil_p),
                    "oil_temp": ch(oil_t_raw),
                    "coolant_temp": ch(self.cool_t),
                },
            },
        }

    def log(self, _t: int) -> str:
        base = (
            f"spd={self.spd:.1f}  oil_t={self.oil_t:.1f}  "
            f"rpm={self.rpm:.0f}  fuel={self.fuel_pct:.1f}%"
        )
        if self._spike_msg:
            return f"{base}  ⚡ {self._spike_msg}"
        return base


if __name__ == "__main__":
    asyncio.run(run(
        "Сценарий 1 · TE33A (Дизель) · Шум датчиков «Борьба с призраками»",
        State(),
    ))
