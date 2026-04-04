from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


# ── Вложенные модели ──────────────────────────────────────────────

class Coordinates(BaseModel):
    lat: float
    lng: float


class BrakeTelemetry(BaseModel):
    tm_pressure: float
    gr_pressure: float
    tc_pressure: float


class TemperatureTelemetry(BaseModel):
    bearings_max: float
    cabin: float


class CommonTelemetry(BaseModel):
    speed_actual: float
    speed_target: float
    traction_force_kn: float
    wheel_slip: bool
    coordinates: Coordinates
    brakes: BrakeTelemetry
    temperatures: TemperatureTelemetry
    board_voltage: float


# ── Power system (дизель / электро) ──────────────────────────────

class DieselPowerSystem(BaseModel):
    diesel_rpm: float
    fuel_level_percent: float
    fuel_consumption_lh: float
    oil_pressure: float
    oil_temp: float
    coolant_temp: float


class ElectricPowerSystem(BaseModel):
    catenary_voltage_kv: float
    pantograph_status: str
    traction_current_a: float
    transformer_temp: float


# ── Телеметрия (объединённая) ─────────────────────────────────────

class DieselTelemetryData(BaseModel):
    common: CommonTelemetry
    power_system: DieselPowerSystem


class ElectricTelemetryData(BaseModel):
    common: CommonTelemetry
    power_system: ElectricPowerSystem


# ── Алерты ────────────────────────────────────────────────────────

class AlertSchema(BaseModel):
    id: str
    level: Literal["info", "warning", "critical"]
    message: str
    value: float | str | None = None


# ── Пакеты ────────────────────────────────────────────────────────

class DieselTelemetryPacket(BaseModel):
    timestamp: datetime
    locomotive_id: str
    type: Literal["diesel"]
    telemetry: DieselTelemetryData
    alerts: list[AlertSchema] = []


class ElectricTelemetryPacket(BaseModel):
    timestamp: datetime
    locomotive_id: str
    type: Literal["electric"]
    telemetry: ElectricTelemetryData
    alerts: list[AlertSchema] = []


# Discriminated union по полю `type`
TelemetryPacket = Annotated[
    Union[DieselTelemetryPacket, ElectricTelemetryPacket],
    Field(discriminator="type"),
]
