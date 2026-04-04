"""
Сценарий 3 · «Реальная угроза» — KZ8A (Электровоз)

Первые 30 тиков — штатный крейсерский режим (90 км/ч).
На 31-м тике происходит разрыв тормозного шланга:
  • tm_pressure резко падает 5.0 → 1.5 (за ~7 с)
  • tc_pressure подскакивает 0.0 → 4.0 (экстренное торможение)
  • Тяга отключается, тяговый ток падает до нуля
  • Скорость падает до нуля (~2.5 км/ч каждую секунду)

Бэкенд должен выдать Critical Alert:
«ПАДЕНИЕ ДАВЛЕНИЯ ТМ! ЭКСТРЕННОЕ ТОРМОЖЕНИЕ!»
"""

from __future__ import annotations

import asyncio
import random

from _base import drift, approach, ch, health_status, run

RUPTURE_TICK = 30


class State:
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
        eta = int(self.d_next / max(self.spd, 1) * 60)

        tm_state = 0
        if self.tm < 3.5:
            tm_state = 2 if self.tm < 2.0 else 1
        tc_state = 1 if self.tc > 2.5 else 0

        return {
            "locomotive_id": "KZ8A-0021",
            "type": "electric",
            "health": {"index": self.hp, "status": health_status(self.hp)},
            "route_map": {
                "next_point": "Шу",
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
                    "catenary_voltage_kv": ch(self.cat_kv),
                    "pantograph_status": ch("raised"),
                    "traction_current_a": ch(self.traction_a),
                    "transformer_temp": ch(self.trans_t),
                },
            },
        }

    # ── phase handlers ────────────────────────────────────────

    def _tick_cruise(self) -> None:
        self._phase = "CRUISE"
        self.spd = drift(self.spd, self.spd_tgt, 1.5, 80, 100)
        self.traction = drift(self.traction, 130, 15, 80, 180)
        self.tm = drift(self.tm, 5.1, 0.05, 5.0, 5.2)
        self.gr = drift(self.gr, 8.7, 0.1, 8.5, 9.0)
        self.tc = drift(self.tc, 0.0, 0.02, 0.0, 0.1)
        self.bearings = drift(self.bearings, 60.0, 0.5, 55, 65)
        self.cabin = drift(self.cabin, 22.0, 0.2, 20, 24)
        self.bv = drift(self.bv, 110, 0.3, 108, 112)
        self.cat_kv = drift(self.cat_kv, 27.0, 0.1, 26.8, 27.2)
        self.traction_a = drift(self.traction_a, 220, 15, 150, 300)
        self.trans_t = drift(self.trans_t, 70, 0.8, 65, 75)
        self.hp = max(85, min(100, self.hp + random.randint(-1, 1)))

    def _tick_rupture(self) -> None:
        self._phase = "!! RUPTURE"
        self.tm = approach(self.tm, 1.5, random.uniform(0.4, 0.6))
        self.tc = approach(self.tc, 4.0, random.uniform(0.5, 0.7))
        self.gr = drift(self.gr, 8.5, 0.1, 8.0, 9.0)
        self.traction = approach(self.traction, 0, 25)
        self.traction_a = approach(self.traction_a, 0, random.uniform(25, 40))
        self.cat_kv = approach(self.cat_kv, 27.3, 0.1)
        self.trans_t = approach(self.trans_t, 55, 0.5)
        self.spd = max(0, round(self.spd - random.uniform(2.0, 3.5), 2))
        self.bearings = drift(self.bearings, 58, 0.5, 50, 70)
        self.cabin = drift(self.cabin, 22.0, 0.2, 20, 24)
        self.bv = drift(self.bv, 110, 0.5, 106, 114)
        self.hp = max(30, self.hp - random.randint(3, 6))

    def _tick_standstill(self) -> None:
        self._phase = "STOP"
        self.spd = 0.0
        self.traction = 0.0
        self.traction_a = drift(self.traction_a, 30, 5, 0, 50)
        self.tm = drift(self.tm, 1.5, 0.05, 1.0, 2.0)
        self.tc = drift(self.tc, 4.0, 0.05, 3.5, 4.5)
        self.gr = drift(self.gr, 8.5, 0.1, 8.0, 9.0)
        self.cat_kv = drift(self.cat_kv, 27.3, 0.1, 27.0, 27.5)
        self.trans_t = approach(self.trans_t, 45, 0.3)
        self.bearings = approach(self.bearings, 30, 0.3)
        self.cabin = drift(self.cabin, 22.0, 0.2, 20, 24)
        self.bv = drift(self.bv, 110, 0.3, 108, 112)
        self.hp = max(30, min(50, self.hp + random.randint(-1, 0)))

    def log(self, _t: int) -> str:
        return (
            f"{self._phase:12s}  spd={self.spd:5.1f}  "
            f"tm={self.tm:.1f}  tc={self.tc:.1f}  "
            f"cur={self.traction_a:.0f}A  hp={self.hp}"
        )


if __name__ == "__main__":
    asyncio.run(run(
        "Сценарий 3 · KZ8A (Электровоз) · Обрыв ТМ «Реальная угроза»",
        State(),
    ))
