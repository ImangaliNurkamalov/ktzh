from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class TelemetryChannel(BaseModel):
    """Параметр в формате бортовой системы: значение + код состояния."""

    model_config = ConfigDict(extra="forbid")

    value: float | int | bool | str
    state: int = 0


class BrakesIngress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tm_pressure: TelemetryChannel
    gr_pressure: TelemetryChannel
    tc_pressure: TelemetryChannel


class TemperaturesIngress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bearings_max: TelemetryChannel
    cabin: TelemetryChannel


class CommonTelemetryIngress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speed_actual: TelemetryChannel
    speed_target: TelemetryChannel
    traction_force_kn: TelemetryChannel
    wheel_slip: TelemetryChannel
    brakes: BrakesIngress
    temperatures: TemperaturesIngress
    board_voltage: TelemetryChannel


class DieselPowerIngress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    diesel_rpm: TelemetryChannel
    fuel_level_percent: TelemetryChannel
    fuel_consumption_lh: TelemetryChannel
    oil_pressure: TelemetryChannel
    oil_temp: TelemetryChannel
    coolant_temp: TelemetryChannel


class ElectricPowerIngress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    catenary_voltage_kv: TelemetryChannel
    pantograph_status: TelemetryChannel
    traction_current_a: TelemetryChannel
    transformer_temp: TelemetryChannel


class DieselTelemetryIngress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    common: CommonTelemetryIngress
    power_system: DieselPowerIngress


class ElectricTelemetryIngress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    common: CommonTelemetryIngress
    power_system: ElectricPowerIngress


class HealthIngress(BaseModel):
    """Только после расчёта на бэкенде; с борта не приходит."""

    index: int
    status: str


class RouteMapIngress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    initial_point: str | None = None
    last_point: str | None = None
    next_point: str
    end_point: str
    distance_to_next_km: float
    eta_next_minutes: int
    total_distance_left_km: float
    total_eta_minutes: int | None = None
    current_stop_type: str | None = None


class LocomotiveDieselIngress(BaseModel):
    """Вход с борта: без ``health`` (лишние поля запрещены)."""

    model_config = ConfigDict(extra="forbid")

    timestamp: datetime | None = None
    locomotive_id: str
    type: Literal["diesel"] = "diesel"
    route_map: RouteMapIngress
    telemetry: DieselTelemetryIngress


class LocomotiveElectricIngress(BaseModel):
    """Вход с борта: без ``health`` (лишние поля запрещены)."""

    model_config = ConfigDict(extra="forbid")

    timestamp: datetime | None = None
    locomotive_id: str
    type: Literal["electric"] = "electric"
    route_map: RouteMapIngress
    telemetry: ElectricTelemetryIngress


LocomotiveIngress = Annotated[
    Union[LocomotiveDieselIngress, LocomotiveElectricIngress],
    Field(discriminator="type"),
]
