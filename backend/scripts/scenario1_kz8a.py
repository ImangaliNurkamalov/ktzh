"""
Сценарий 1 · «Борьба с призраками» — KZ8A (Электровоз)

Локомотив едет на крейсерской скорости (90 км/ч).
Раз в ~14 секунд датчик transformer_temp или speed_actual выдаёт
одиночную «иглу» — значение подскакивает на 1 тик и возвращается.

Бэкенд должен отфильтровать спайки (медиана + EMA) и НЕ генерировать
ложных алертов.
"""

from __future__ import annotations

import asyncio
import random

from _base import drift, ch, run

SPIKE_PROBABILITY = 0.07


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
        self._spike_msg = ""

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

        spd_raw = self.spd
        trans_t_raw = self.trans_t
        self._spike_msg = ""

        if random.random() < SPIKE_PROBABILITY:
            if random.random() < 0.5:
                spd_raw = round(random.uniform(200, 280), 2)
                self._spike_msg = f"SPIKE speed -> {spd_raw}"
            else:
                trans_t_raw = round(random.uniform(160, 200), 2)
                self._spike_msg = f"SPIKE transformer_temp -> {trans_t_raw}"

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
                    "catenary_voltage_kv": ch(self.cat_kv),
                    "pantograph_status": ch("raised"),
                    "traction_current_a": ch(self.traction_a),
                    "transformer_temp": ch(trans_t_raw),
                },
            },
        }

    def log(self, _t: int) -> str:
        base = (
            f"spd={self.spd:.1f}  trans_t={self.trans_t:.1f}  "
            f"cur={self.traction_a:.0f}A  cat={self.cat_kv:.1f}kV"
        )
        if self._spike_msg:
            return f"{base}  ⚡ {self._spike_msg}"
        return base


if __name__ == "__main__":
    asyncio.run(run(
        "Сценарий 1 · KZ8A (Электровоз) · Шум датчиков «Борьба с призраками»",
        State(),
    ))
