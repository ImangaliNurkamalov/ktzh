from __future__ import annotations

from app.schemas.health import HealthFactor, HealthResult
from app.schemas.telemetry import (
    AlertSchema,
    CommonTelemetry,
    DieselPowerSystem,
    DieselTelemetryPacket,
    ElectricPowerSystem,
    ElectricTelemetryPacket,
)


def _evaluate_common(common: CommonTelemetry) -> list[HealthFactor]:
    factors: list[HealthFactor] = []

    if common.wheel_slip:
        factors.append(HealthFactor(name="wheel_slip", impact=-15))

    if common.brakes.tm_pressure < 4.5:
        factors.append(HealthFactor(name="tm_pressure_low", impact=-15))

    if common.brakes.gr_pressure < 7.0:
        factors.append(HealthFactor(name="gr_pressure_low", impact=-10))

    # bearings_max > 80 перекрывает > 70
    if common.temperatures.bearings_max > 80:
        factors.append(HealthFactor(name="bearings_max_critical", impact=-25))
    elif common.temperatures.bearings_max > 70:
        factors.append(HealthFactor(name="bearings_max_warning", impact=-10))

    if abs(common.board_voltage - 110) > 10:
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

    # Сортируем по абсолютному влиянию (самые тяжёлые — первые)
    top_factors = sorted(factors, key=lambda f: f.impact)

    return HealthResult(score=score, status=status, top_factors=top_factors)
