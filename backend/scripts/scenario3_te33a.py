"""
Сценарий 3 · «Реальная угроза» — TE33A (Дизельный локомотив)

Первые 30 тиков — штатный крейсерский режим (80 км/ч).
На 31-м тике происходит разрыв тормозного шланга:
  • tm_pressure резко падает 5.0 → 1.5 (за ~7 с)
  • tc_pressure подскакивает 0.0 → 4.0 (экстренное торможение)
  • Тяга сбрасывается, дизель на холостых
  • Скорость падает до нуля (~2.5 км/ч каждую секунду)

Бэкенд должен выдать Critical Alert:
«ПАДЕНИЕ ДАВЛЕНИЯ ТМ! ЭКСТРЕННОЕ ТОРМОЖЕНИЕ!»
"""

from __future__ import annotations

import asyncio
import random

from _base import drift, approach, ch, run

RUPTURE_TICK = 30


class State:
    def __init__(self) -> None:
        # --- cruising initial ---
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
        self._phase = "CRUISE"

    def tick(self, t: int) -> dict:
        if t <= RUPTURE_TICK:
            self._tick_cruise()
        elif self.spd > 0.5:
            self._tick_rupture()
        else:
            self._tick_standstill()

        km_s = self.spd / 3600
        self.d_next = max(0, round(self.d_next - km_s, 2))
        self.d_total = max(0, round(self.d_total - km_s, 2))
        self.fuel_pct = max(0, round(self.fuel_pct - self.fuel_cons / 3600, 2))
        eta = int(self.d_next / max(self.spd, 1) * 60)

        tm_state = 0
        if self.tm < 3.5:
            tm_state = 2 if self.tm < 2.0 else 1
        tc_state = 1 if self.tc > 2.5 else 0

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
                    "speed_actual": ch(self.spd),
                    "speed_target": ch(self.spd_tgt),
                    "traction_force_kn": ch(self.traction),
                    "wheel_slip": ch(False),
                    "brakes": {
                        "tm_pressure": ch(self.tm, tm_state),
                        "gr_pressure": ch(self.gr),
                        "tc_pressure": ch(self.tc, tc_state),
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
                    "oil_temp": ch(self.oil_t),
                    "coolant_temp": ch(self.cool_t),
                },
            },
        }

    # ── phase handlers ────────────────────────────────────────

    def _tick_cruise(self) -> None:
        self._phase = "CRUISE"
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

    def _tick_rupture(self) -> None:
        self._phase = "!! RUPTURE"
        self.tm = approach(self.tm, 1.5, random.uniform(0.4, 0.6))
        self.tc = approach(self.tc, 4.0, random.uniform(0.5, 0.7))
        self.gr = drift(self.gr, 8.5, 0.1, 8.0, 9.0)
        self.traction = approach(self.traction, 0, 20)
        self.rpm = approach(self.rpm, 350, random.uniform(30, 50))
        self.fuel_cons = approach(self.fuel_cons, 20, 10)
        self.oil_p = approach(self.oil_p, 2.0, 0.2)
        self.spd = max(0, round(self.spd - random.uniform(2.0, 3.5), 2))
        self.oil_t = approach(self.oil_t, 70, 0.3)
        self.cool_t = approach(self.cool_t, 70, 0.3)
        self.bearings = drift(self.bearings, 58, 0.5, 50, 70)
        self.cabin = drift(self.cabin, 22.0, 0.2, 20, 24)
        self.bv = drift(self.bv, 110, 0.5, 106, 114)

    def _tick_standstill(self) -> None:
        self._phase = "STOP"
        self.spd = 0.0
        self.traction = 0.0
        self.tm = drift(self.tm, 1.5, 0.05, 1.0, 2.0)
        self.tc = drift(self.tc, 4.0, 0.05, 3.5, 4.5)
        self.gr = drift(self.gr, 8.5, 0.1, 8.0, 9.0)
        self.rpm = drift(self.rpm, 350, 10, 300, 400)
        self.fuel_cons = drift(self.fuel_cons, 20, 2, 15, 25)
        self.oil_p = drift(self.oil_p, 2.0, 0.1, 1.5, 2.5)
        self.oil_t = approach(self.oil_t, 65, 0.2)
        self.cool_t = approach(self.cool_t, 65, 0.2)
        self.bearings = approach(self.bearings, 30, 0.3)
        self.cabin = drift(self.cabin, 22.0, 0.2, 20, 24)
        self.bv = drift(self.bv, 110, 0.3, 108, 112)

    def log(self, _t: int) -> str:
        return (
            f"{self._phase:12s}  spd={self.spd:5.1f}  "
            f"tm={self.tm:.1f}  tc={self.tc:.1f}  "
            f"rpm={self.rpm:.0f}"
        )


if __name__ == "__main__":
    asyncio.run(run(
        "Сценарий 3 · TE33A (Дизель) · Обрыв ТМ «Реальная угроза»",
        State(),
    ))
