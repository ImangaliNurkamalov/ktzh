from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.services.report_service import fetch_records_last_n_minutes, generate_pdf

router = APIRouter(prefix="/api", tags=["report"])


@router.get(
    "/report/pdf",
    summary="PDF-отчёт телеметрии за последние N минут",
    response_class=Response,
)
async def report_pdf(
    minutes: int = Query(default=15, ge=1, le=1440),
    locomotive_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> Response:
    records = await fetch_records_last_n_minutes(session, minutes, locomotive_id)
    pdf_bytes = generate_pdf(records, minutes, locomotive_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=telemetry_report.pdf"},
    )
