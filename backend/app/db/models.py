from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class TelemetryRecord(Base):
    __tablename__ = "telemetry_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # TIMESTAMPTZ: Pydantic отдаёт aware-datetime (например из ISO с Z); без timezone=True asyncpg падает.
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    locomotive_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    locomotive_type: Mapped[str] = mapped_column(String(16), nullable=False)

    speed_actual: Mapped[float] = mapped_column(Float, nullable=False)
    speed_target: Mapped[float] = mapped_column(Float, nullable=False)
    traction_force_kn: Mapped[float] = mapped_column(Float, nullable=False)
    wheel_slip: Mapped[bool] = mapped_column(Boolean, nullable=False)

    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)

    tm_pressure: Mapped[float] = mapped_column(Float, nullable=False)
    gr_pressure: Mapped[float] = mapped_column(Float, nullable=False)
    tc_pressure: Mapped[float] = mapped_column(Float, nullable=False)

    bearings_max: Mapped[float] = mapped_column(Float, nullable=False)
    cabin_temp: Mapped[float] = mapped_column(Float, nullable=False)
    board_voltage: Mapped[float] = mapped_column(Float, nullable=False)

    health_score: Mapped[int] = mapped_column(Integer, nullable=False)
    health_status: Mapped[str] = mapped_column(String(16), nullable=False)

    raw_payload: Mapped[str] = mapped_column(Text, nullable=False)

    alerts: Mapped[list["AlertRecord"]] = relationship(back_populates="telemetry_record", cascade="all, delete-orphan")


class AlertRecord(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telemetry_record_id: Mapped[int] = mapped_column(ForeignKey("telemetry_records.id"), nullable=False)
    alert_id: Mapped[str] = mapped_column(String(128), nullable=False)
    level: Mapped[str] = mapped_column(String(16), nullable=False)
    message: Mapped[str] = mapped_column(String(512), nullable=False)
    value: Mapped[str | None] = mapped_column(String(128), nullable=True)

    telemetry_record: Mapped["TelemetryRecord"] = relationship(back_populates="alerts")
