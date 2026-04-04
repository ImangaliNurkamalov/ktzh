from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal

from app.schemas.locomotive_ingress import (
    CommonTelemetryIngress,
    DieselPowerIngress,
    ElectricPowerIngress,
    HealthIngress,
    LocomotiveDieselIngress,
    LocomotiveElectricIngress,
    TelemetryChannel,
)


def _ch_float(ch: TelemetryChannel) -> float:
    v = ch.value
    if isinstance(v, bool):
        return float(v)
    if isinstance(v, (int, float)):
        return float(v)
    return float(v)


def _ch_bool(ch: TelemetryChannel) -> bool:
    v = ch.value
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    return str(v).lower() in ("1", "true", "yes", "on")


def _ch_str(ch: TelemetryChannel) -> str:
    v = ch.value
    if isinstance(v, str):
        return v
    return str(v)


def _with_sensor_quality(score: float, state: int) -> float:
    """state == 2 — датчик неисправен; не даём «хорошей» оценке по мусору."""
    if state == 2:
        return min(score, 0.42)
    return score


def _lin_clamp(x: float, x0: float, x1: float, y0: float, y1: float) -> float:
    if x0 > x1:
        x0, x1 = x1, x0
        y0, y1 = y1, y0
    if x <= x0:
        return y0
    if x >= x1:
        return y1
    t = (x - x0) / (x1 - x0)
    return y0 + t * (y1 - y0)


# --- поэлементные оценки s_i ∈ [0, 1] ---


def _score_wheel_slip(c: CommonTelemetryIngress, _d: DieselPowerIngress | None, _e: ElectricPowerIngress | None) -> float:
    ch = c.wheel_slip
    s = 0.0 if _ch_bool(ch) else 1.0
    return _with_sensor_quality(s, ch.state)


def _score_tm(c: CommonTelemetryIngress, _d: DieselPowerIngress | None, _e: ElectricPowerIngress | None) -> float:
    ch = c.brakes.tm_pressure
    v = _ch_float(ch)
    s = _lin_clamp(v, 2.0, 4.5, 0.0, 1.0)
    return _with_sensor_quality(s, ch.state)


def _score_gr(c: CommonTelemetryIngress, _d: DieselPowerIngress | None, _e: ElectricPowerIngress | None) -> float:
    ch = c.brakes.gr_pressure
    v = _ch_float(ch)
    s = _lin_clamp(v, 5.0, 7.0, 0.0, 1.0)
    return _with_sensor_quality(s, ch.state)


def _score_bearings(c: CommonTelemetryIngress, _d: DieselPowerIngress | None, _e: ElectricPowerIngress | None) -> float:
    ch = c.temperatures.bearings_max
    v = _ch_float(ch)
    if v <= 70.0:
        s = 1.0
    elif v <= 80.0:
        s = 1.0 - 0.75 * (v - 70.0) / 10.0
    elif v <= 95.0:
        s = max(0.0, 0.25 * (95.0 - v) / 15.0)
    else:
        s = 0.0
    return _with_sensor_quality(s, ch.state)


def _score_board_voltage(c: CommonTelemetryIngress, _d: DieselPowerIngress | None, _e: ElectricPowerIngress | None) -> float:
    ch = c.board_voltage
    d = abs(_ch_float(ch) - 110.0)
    s = _lin_clamp(d, 8.0, 18.0, 1.0, 0.0)
    return _with_sensor_quality(s, ch.state)


def _score_fuel(
    _c: CommonTelemetryIngress, d: DieselPowerIngress | None, _e: ElectricPowerIngress | None
) -> float:
    assert d is not None
    ch = d.fuel_level_percent
    v = _ch_float(ch)
    s = 1.0 if v >= 20.0 else max(0.0, min(1.0, v / 20.0))
    return _with_sensor_quality(s, ch.state)


def _score_oil_pressure(
    _c: CommonTelemetryIngress, d: DieselPowerIngress | None, _e: ElectricPowerIngress | None
) -> float:
    assert d is not None
    ch = d.oil_pressure
    v = _ch_float(ch)
    s = _lin_clamp(v, 1.5, 3.0, 0.0, 1.0)
    return _with_sensor_quality(s, ch.state)


def _score_oil_temp(
    _c: CommonTelemetryIngress, d: DieselPowerIngress | None, _e: ElectricPowerIngress | None
) -> float:
    assert d is not None
    ch = d.oil_temp
    v = _ch_float(ch)
    s = _lin_clamp(v, 85.0, 105.0, 1.0, 0.0)
    return _with_sensor_quality(s, ch.state)


def _score_coolant(
    _c: CommonTelemetryIngress, d: DieselPowerIngress | None, _e: ElectricPowerIngress | None
) -> float:
    assert d is not None
    ch = d.coolant_temp
    v = _ch_float(ch)
    s = _lin_clamp(v, 82.0, 100.0, 1.0, 0.0)
    return _with_sensor_quality(s, ch.state)


def _score_catenary(
    _c: CommonTelemetryIngress, _d: DieselPowerIngress | None, e: ElectricPowerIngress | None
) -> float:
    assert e is not None
    ch = e.catenary_voltage_kv
    v = _ch_float(ch)
    s = _lin_clamp(v, 18.0, 25.0, 0.0, 1.0)
    return _with_sensor_quality(s, ch.state)


def _score_pantograph(
    _c: CommonTelemetryIngress, _d: DieselPowerIngress | None, e: ElectricPowerIngress | None
) -> float:
    assert e is not None
    ch = e.pantograph_status
    s = 1.0 if _ch_str(ch).lower() == "raised" else 0.0
    return _with_sensor_quality(s, ch.state)


def _score_transformer(
    _c: CommonTelemetryIngress, _d: DieselPowerIngress | None, e: ElectricPowerIngress | None
) -> float:
    assert e is not None
    ch = e.transformer_temp
    v = _ch_float(ch)
    s = _lin_clamp(v, 78.0, 92.0, 1.0, 0.0)
    return _with_sensor_quality(s, ch.state)


def _score_traction_current(
    _c: CommonTelemetryIngress, _d: DieselPowerIngress | None, e: ElectricPowerIngress | None
) -> float:
    assert e is not None
    ch = e.traction_current_a
    v = _ch_float(ch)
    s = _lin_clamp(v, 650.0, 800.0, 1.0, 0.0)
    return _with_sensor_quality(s, ch.state)


@dataclass(frozen=True)
class _ElementSpec:
    id: str
    weight: float
    critical: bool
    domain: Literal["common", "diesel", "electric"]


_SCORERS: dict[str, Callable[[CommonTelemetryIngress, DieselPowerIngress | None, ElectricPowerIngress | None], float]] = {
    "wheel_slip": _score_wheel_slip,
    "tm_pressure": _score_tm,
    "gr_pressure": _score_gr,
    "bearings_max": _score_bearings,
    "board_voltage": _score_board_voltage,
    "fuel_level": _score_fuel,
    "oil_pressure": _score_oil_pressure,
    "oil_temp": _score_oil_temp,
    "coolant_temp": _score_coolant,
    "catenary_voltage": _score_catenary,
    "pantograph": _score_pantograph,
    "transformer_temp": _score_transformer,
    "traction_current": _score_traction_current,
}

_ELEMENT_SPECS: tuple[_ElementSpec, ...] = (
    _ElementSpec("wheel_slip", 2.5, True, "common"),
    _ElementSpec("tm_pressure", 3.0, True, "common"),
    _ElementSpec("gr_pressure", 1.5, False, "common"),
    _ElementSpec("bearings_max", 2.0, False, "common"),
    _ElementSpec("board_voltage", 0.8, False, "common"),
    _ElementSpec("fuel_level", 0.5, False, "diesel"),
    _ElementSpec("oil_pressure", 2.0, False, "diesel"),
    _ElementSpec("oil_temp", 1.2, False, "diesel"),
    _ElementSpec("coolant_temp", 1.0, False, "diesel"),
    _ElementSpec("catenary_voltage", 2.0, False, "electric"),
    _ElementSpec("pantograph", 3.0, True, "electric"),
    _ElementSpec("transformer_temp", 1.5, False, "electric"),
    _ElementSpec("traction_current", 1.0, False, "electric"),
)


def _raw_health_unit(
    common: CommonTelemetryIngress,
    diesel: DieselPowerIngress | None,
    electric: ElectricPowerIngress | None,
) -> float:
    is_diesel = diesel is not None
    w_sum = 0.0
    w_s = 0.0
    critical_scores: list[float] = []

    for spec in _ELEMENT_SPECS:
        if spec.domain == "diesel" and not is_diesel:
            continue
        if spec.domain == "electric" and is_diesel:
            continue
        fn = _SCORERS[spec.id]
        s = fn(common, diesel, electric)
        w_sum += spec.weight
        w_s += spec.weight * s
        if spec.critical:
            critical_scores.append(s)

    if w_sum <= 0:
        return 1.0

    h_avg = w_s / w_sum
    crit_floor = min(critical_scores) if critical_scores else 1.0
    return min(h_avg, crit_floor)


class _HealthSmoother:
    """Быстрее падает вниз, медленнее поднимается (авария не «мигает»)."""

    def __init__(self, alpha_down: float = 0.38, alpha_up: float = 0.09) -> None:
        self._alpha_down = alpha_down
        self._alpha_up = alpha_up
        self._value: float | None = None

    def step(self, raw: float) -> float:
        raw = max(0.0, min(1.0, raw))
        if self._value is None:
            self._value = raw
            return raw
        alpha = self._alpha_down if raw < self._value else self._alpha_up
        self._value = (1.0 - alpha) * self._value + alpha * raw
        return max(0.0, min(1.0, self._value))


_smoothers: dict[str, _HealthSmoother] = {}


def _smoother_for(locomotive_id: str) -> _HealthSmoother:
    if locomotive_id not in _smoothers:
        _smoothers[locomotive_id] = _HealthSmoother()
    return _smoothers[locomotive_id]


def compute_health_from_ingress(
    packet: LocomotiveDieselIngress | LocomotiveElectricIngress,
) -> HealthIngress:
    """Индекс 0–100: взвешенное среднее по подсистемам + потолок по критичным каналам; сглаживание по времени."""
    common = packet.telemetry.common
    if isinstance(packet, LocomotiveDieselIngress):
        diesel = packet.telemetry.power_system
        electric = None
    else:
        diesel = None
        electric = packet.telemetry.power_system

    raw_unit = _raw_health_unit(common, diesel, electric)
    smoothed_unit = _smoother_for(packet.locomotive_id).step(raw_unit)
    score = max(0, min(100, int(round(100.0 * smoothed_unit))))

    if score >= 85:
        status = "normal"
    elif score >= 60:
        status = "warning"
    else:
        status = "critical"

    return HealthIngress(index=score, status=status)
