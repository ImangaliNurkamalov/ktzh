from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.services.history_service import get_history

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
async def history(
    locomotive_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    return await get_history(session, locomotive_id=locomotive_id, limit=limit)
