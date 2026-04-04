from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TelemetryRecord


async def get_history(
    session: AsyncSession,
    locomotive_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    stmt = select(TelemetryRecord).order_by(TelemetryRecord.timestamp.desc())

    if locomotive_id:
        stmt = stmt.where(TelemetryRecord.locomotive_id == locomotive_id)

    stmt = stmt.limit(limit)
    result = await session.execute(stmt)
    records = result.scalars().all()

    return [
        {
            "timestamp": r.timestamp.isoformat(),
            "locomotive_id": r.locomotive_id,
            "type": r.locomotive_type,
            "speed_actual": r.speed_actual,
            "bearings_max": r.bearings_max,
            "health_score": r.health_score,
            "health_status": r.health_status,
        }
        for r in records
    ]
