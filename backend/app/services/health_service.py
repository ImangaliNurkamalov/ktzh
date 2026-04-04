from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.schemas.health import HealthFactor, HealthResult
from app.schemas.locomotive_ingress import (
    LocomotiveDieselIngress,
    LocomotiveElectricIngress,
    TelemetryChannel,
)
from app.schemas.telemetry import (
    AlertSchema,
    CommonTelemetry,
    DieselPowerSystem,
    DieselTelemetryPacket,
    ElectricPowerSystem,
    ElectricTelemetryPacket,
)


# ── Сглаживание индекса по locomotive_id (доля [0,1]) ─────────────────
_ALPHA_DOWN = 0.38
_ALPHA_UP = 0.09
_smooth_by_loco: dict[str, float] = {}


def _segment(x: float, x0: float, x1: float, y0: float, y1: float) -> float:
    """Линейно: x0→y0, x1→y1, за пределами — зажатие."""
    if x0 > x1:
        x0, x1, y0, y1 = x1, x0, y1, y0
    if x <= x0:
        return y0
    if x >= x1:
        return y1
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def _sensor_cap(s: float, state: int) -> float:
    if state == 2:
        return min(s, 0.42)
    return s


def _ch_float(ch: TelemetryChannel) -> tuple[float, int]:
    v = ch.value
    if isinstance(v, bool):
        return (float(v), ch.state)
    if isinstance(v, (int, float)):
        return (float(v), ch.state)
    try:
        return (float(v), ch.state)
    except (TypeError, ValueError):
        return (0.0, ch.state)


def _ch_bool(ch: TelemetryChannel) -> tuple[bool, int]:
    v = ch.value
    if isinstance(v, bool):
        return (v, ch.state)
    if isinstance(v, (int, float)):
        return (bool(v), ch.state)
    return (str(v).lower() in ("1", "true", "yes", "on"), ch.state)


def _ch_str(ch: TelemetryChannel) -> tuple[str, int]:
    return (str(ch.value), ch.state)


def _score_tm(ch: TelemetryChannel) -> float:
    x, st = _ch_float(ch)
    return _sensor_cap(_segment(x, 2.0, 4.5, 0.0, 1.0), st)


def _score_gr(ch: TelemetryChannel) -> float:
    x, st = _ch_float(ch)
    return _sensor_cap(_segment(x, 5.0, 7.0, 0.0, 1.0), st)


def _score_board_voltage(ch: TelemetryChannel) -> float:
    v, st = _ch_float(ch)
    d = abs(v - 110.0)
    return _sensor_cap(_segment(d, 8.0, 18.0, 1.0, 0.0), st)


def _score_bearings(ch: TelemetryChannel) -> float:
    t, st = _ch_float(ch)
    if t <= 70:
        s = 1.0
    elif t <= 80:
        s = _segment(t, 70.0, 80.0, 1.0, 0.25)
    elif t <= 95:
        s = _segment(t, 80.0, 95.0, 0.25, 0.0)
    else:
        s = 0.0
    return _sensor_cap(s, st)


def _score_wheel_slip(ch: TelemetryChannel) -> float:
    slip, st = _ch_bool(ch)
    return _sensor_cap(0.0 if slip else 1.0, st)


def _score_oil_pressure(ch: TelemetryChannel) -> float:
    x, st = _ch_float(ch)
    return _sensor_cap(_segment(x, 1.5, 3.0, 0.0, 1.0), st)


def _score_oil_temp(ch: TelemetryChannel) -> float:
    x, st = _ch_float(ch)
    return _sensor_cap(_segment(x, 85.0, 105.0, 1.0, 0.0), st)


def _score_coolant_temp(ch: TelemetryChannel) -> float:
    x, st = _ch_float(ch)
    return _sensor_cap(_segment(x, 82.0, 100.0, 1.0, 0.0), st)


def _score_fuel_level(ch: TelemetryChannel) -> float:
    x, st = _ch_float(ch)
    return _sensor_cap(_segment(x, 0.0, 20.0, 0.0, 1.0), st)


def _score_catenary(ch: TelemetryChannel) -> float:
    x, st = _ch_float(ch)
    return _sensor_cap(_segment(x, 18.0, 25.0, 0.0, 1.0), st)


def _score_pantograph(ch: TelemetryChannel) -> float:
    s_raw, st = _ch_str(ch)
    ok = s_raw.strip().casefold() == "raised"
    return _sensor_cap(1.0 if ok else 0.0, st)


def _score_transformer_temp(ch: TelemetryChannel) -> float:
    x, st = _ch_float(ch)
    return _sensor_cap(_segment(x, 78.0, 92.0, 1.0, 0.0), st)


def _score_traction_current(ch: TelemetryChannel) -> float:
    x, st = _ch_float(ch)
    return _sensor_cap(_segment(x, 650.0, 800.0, 1.0, 0.0), st)


@dataclass(frozen=True)
class HealthFromIngress:
    index: int
    status: Literal["normal", "warning", "critical"]


def compute_health_from_ingress(
    packet: LocomotiveDieselIngress | LocomotiveElectricIngress,
) -> HealthFromIngress:
    """
    Индекс 0–100 и статус по телеметрии ingress. Поле health с борта не используется.
    """
    c = packet.telemetry.common
    entries: list[tuple[float, float, bool]] = []

    entries.append((_score_tm(c.brakes.tm_pressure), 2.0, True))
    entries.append((_score_gr(c.brakes.gr_pressure), 1.0, False))
    entries.append((_score_wheel_slip(c.wheel_slip), 2.0, True))
    entries.append((_score_board_voltage(c.board_voltage), 1.0, False))
    entries.append((_score_bearings(c.temperatures.bearings_max), 1.2, False))

    if isinstance(packet, LocomotiveDieselIngress):
        d = packet.telemetry.power_system
        entries.append((_score_oil_pressure(d.oil_pressure), 1.5, True))
        entries.append((_score_oil_temp(d.oil_temp), 1.0, False))
        entries.append((_score_coolant_temp(d.coolant_temp), 1.0, False))
        entries.append((_score_fuel_level(d.fuel_level_percent), 0.8, False))
    else:
        e = packet.telemetry.power_system
        entries.append((_score_catenary(e.catenary_voltage_kv), 1.5, True))
        entries.append((_score_pantograph(e.pantograph_status), 2.0, True))
        entries.append((_score_transformer_temp(e.transformer_temp), 1.0, False))
        entries.append((_score_traction_current(e.traction_current_a), 1.0, False))

    w_sum = sum(w for _, w, _ in entries)
    h_avg = sum(s * w for s, w, _ in entries) / w_sum
    crit = [s for s, _, is_c in entries if is_c]
    c_floor = min(crit) if crit else 1.0
    h_raw = min(h_avg, c_floor)
    h_raw = max(0.0, min(1.0, h_raw))

    loco_id = packet.locomotive_id
    if loco_id not in _smooth_by_loco:
        h_smooth = h_raw
    else:
        prev = _smooth_by_loco[loco_id]
        alpha = _ALPHA_DOWN if h_raw < prev else _ALPHA_UP
        h_smooth = (1.0 - alpha) * prev + alpha * h_raw
    _smooth_by_loco[loco_id] = h_smooth

    index = int(round(100.0 * max(0.0, min(1.0, h_smooth))))
    if index >= 85:
        status: Literal["normal", "warning", "critical"] = "normal"
    elif index >= 60:
        status = "warning"
    else:
        status = "critical"

    return HealthFromIngress(index=index, status=status)


def reset_health_smooth_for_tests() -> None:
    """Только для тестов."""
    _smooth_by_loco.clear()


# ── Старый контракт /api/telemetry (TelemetryPacket) ────────────────────


def _evaluate_common(packet_common: CommonTelemetry) -> list[HealthFactor]:
    factors: list[HealthFactor] = []

    if packet_common.wheel_slip:
        factors.append(HealthFactor(name="wheel_slip", impact=-15))

    if packet_common.brakes.tm_pressure < 4.5:
        factors.append(HealthFactor(name="tm_pressure_low", impact=-15))

    if packet_common.brakes.gr_pressure < 7.0:
        factors.append(HealthFactor(name="gr_pressure_low", impact=-10))

    if packet_common.temperatures.bearings_max > 80:
        factors.append(HealthFactor(name="bearings_max_critical", impact=-25))
    elif packet_common.temperatures.bearings_max > 70:
        factors.append(HealthFactor(name="bearings_max_warning", impact=-10))

    if abs(packet_common.board_voltage - 110) > 10:
        factors.append(HealthFactor(name="board_voltage_deviation", impact=-5))

    return factors


def _evaluate_diesel(ps: DieselPowerSystem) -> list[HealthFactor]:
    factors: list[HealthFactor] = []

    if ps.fuel_level_percent < 20:
        factors.append(HealthFactor(name="fuel_level_low", impact=-10))
    if ps.oil_pressure < 3.0:
        factors.append(HealthFactor(name="oil_pressure_low", impact=-25))
    if ps.oil_temp > 95:
        factors.append(HealthFactor(name="oil_temp_high", impact=-15))
    if ps.coolant_temp > 90:
        factors.append(HealthFactor(name="coolant_temp_high", impact=-10))

    return factors


def _evaluate_electric(ps: ElectricPowerSystem) -> list[HealthFactor]:
    factors: list[HealthFactor] = []

    if ps.catenary_voltage_kv < 24:
        factors.append(HealthFactor(name="catenary_voltage_low", impact=-20))
    if ps.pantograph_status != "raised":
        factors.append(HealthFactor(name="pantograph_not_raised", impact=-25))
    if ps.transformer_temp > 85:
        factors.append(HealthFactor(name="transformer_temp_high", impact=-15))
    if ps.traction_current_a > 700:
        factors.append(HealthFactor(name="traction_current_high", impact=-10))

    return factors


def _evaluate_alerts(alerts: list[AlertSchema]) -> list[HealthFactor]:
    factors: list[HealthFactor] = []
    for a in alerts:
        if a.level == "warning":
            factors.append(HealthFactor(name=f"alert_warning_{a.id}", impact=-5))
        elif a.level == "critical":
            factors.append(HealthFactor(name=f"alert_critical_{a.id}", impact=-12))
    return factors


def compute_health(packet: DieselTelemetryPacket | ElectricTelemetryPacket) -> HealthResult:
    common = packet.telemetry.common
    factors: list[HealthFactor] = []

    factors.extend(_evaluate_common(common))

    if isinstance(packet, DieselTelemetryPacket):
        factors.extend(_evaluate_diesel(packet.telemetry.power_system))
    else:
        factors.extend(_evaluate_electric(packet.telemetry.power_system))

    factors.extend(_evaluate_alerts(packet.alerts))

    score = max(0, 100 + sum(f.impact for f in factors))

    if score >= 85:
        status = "normal"
    elif score >= 60:
        status = "warning"
    else:
        status = "critical"

    top_factors = sorted(factors, key=lambda f: f.impact)

    return HealthResult(score=score, status=status, top_factors=top_factors)
