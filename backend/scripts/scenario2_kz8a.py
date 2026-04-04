"""
Сценарий 2 · «Умная диагностика» — KZ8A (Электровоз)

Локомотив едет на крейсерской скорости (90 км/ч). На 20-м тике датчик
transformer_temp «умирает»: контакт отходит, ~30 % показаний — мусор
(случайные скачки ±40–60 °C).

Бэкенд должен вычислить процент шума и показать алерт:
«Высокий уровень шума датчика трансформатора. Возможна неисправность
сенсора».
"""

from __future__ import annotations

import asyncio
import random

from _base import drift, ch, run

SENSOR_BREAK_TICK = 20
NOISE_PROBABILITY = 0.30


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
        self.d_next = 150.0
        self.d_total = 350.0
        self._broken = False
        self._noisy_this_tick = False
        self._noise_count = 0
        self._total_since_break = 0

    def tick(self, t: int) -> dict:
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

        km_s = self.spd / 3600
        self.d_next = max(0, round(self.d_next - km_s, 2))
        self.d_total = max(0, round(self.d_total - km_s, 2))
        eta = int(self.d_next / max(self.spd, 1) * 60)

        trans_t_raw = self.trans_t
        self._noisy_this_tick = False

        if t >= SENSOR_BREAK_TICK:
            self._broken = True
            self._total_since_break += 1
            if random.random() < NOISE_PROBABILITY:
                trans_t_raw = round(self.trans_t + random.uniform(-60, 60), 2)
                trans_t_raw = max(0, trans_t_raw)
                self._noisy_this_tick = True
                self._noise_count += 1

        return {
            "locomotive_id": "KZ8A-0021",
            "type": "electric",
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
                    "catenary_voltage_kv": ch(self.cat_kv),
                    "pantograph_status": ch("raised"),
                    "traction_current_a": ch(self.traction_a),
                    "transformer_temp": ch(trans_t_raw),
                },
            },
        }

    def log(self, t: int) -> str:
        if not self._broken:
            return (
                f"NORMAL   spd={self.spd:.1f}  trans_t={self.trans_t:.1f}  "
                f"cur={self.traction_a:.0f}A"
            )
        noise_pct = (
            int(self._noise_count / self._total_since_break * 100)
            if self._total_since_break
            else 0
        )
        tag = "⚠ NOISE" if self._noisy_this_tick else "      "
        return (
            f"BROKEN   spd={self.spd:.1f}  trans_t={self.trans_t:.1f}  "
            f"noise={noise_pct}%  {tag}"
        )


if __name__ == "__main__":
    asyncio.run(run(
        "Сценарий 2 · KZ8A (Электровоз) · Смерть датчика «Умная диагностика»",
        State(),
    ))
