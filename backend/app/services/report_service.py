"""
PDF-отчёт по телеметрии за заданный интервал.

Генерирует PDF в память (BytesIO) с:
  - заголовком и временным диапазоном
  - сводной таблицей (min/avg/max по ключевым показателям)
  - таблицей записей (последние N строк)
"""

from __future__ import annotations

import io
import logging
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TelemetryRecord

logger = logging.getLogger("report")

_FONT_NAME = "DejaVuSans"
_FONT_REGISTERED = False

_FONT_SEARCH_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
]

_FONT_BOLD_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/DejaVuSans-Bold.ttf",
]


def _find_font(candidates: list[str]) -> str | None:
    for p in candidates:
        if Path(p).is_file():
            return p
    return None


def _register_fonts() -> None:
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return

    regular = _find_font(_FONT_SEARCH_PATHS)
    if regular is None:
        logger.warning("DejaVuSans.ttf не найден; кириллица в PDF будет «квадратиками»")
        return

    pdfmetrics.registerFont(TTFont(_FONT_NAME, regular))
    bold = _find_font(_FONT_BOLD_PATHS)
    if bold:
        pdfmetrics.registerFont(TTFont(f"{_FONT_NAME}-Bold", bold))
        pdfmetrics.registerFontFamily(_FONT_NAME, normal=_FONT_NAME, bold=f"{_FONT_NAME}-Bold")
    _FONT_REGISTERED = True
    logger.info("PDF: зарегистрирован шрифт %s (%s)", _FONT_NAME, regular)


def _cyrillic_styles() -> dict[str, ParagraphStyle]:
    _register_fonts()
    base = getSampleStyleSheet()
    font = _FONT_NAME if _FONT_REGISTERED else "Helvetica"
    font_bold = f"{_FONT_NAME}-Bold" if _FONT_REGISTERED else "Helvetica-Bold"
    return {
        "Title": ParagraphStyle("CyrTitle", parent=base["Title"], fontName=font_bold, fontSize=16),
        "Heading2": ParagraphStyle("CyrH2", parent=base["Heading2"], fontName=font_bold, fontSize=12),
        "Normal": ParagraphStyle("CyrNormal", parent=base["Normal"], fontName=font, fontSize=10),
    }


async def fetch_records_last_n_minutes(
    session: AsyncSession,
    minutes: int = 15,
    locomotive_id: str | None = None,
) -> list[TelemetryRecord]:
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    stmt = (
        select(TelemetryRecord)
        .where(TelemetryRecord.timestamp >= since)
        .order_by(TelemetryRecord.timestamp.asc())
    )
    if locomotive_id:
        stmt = stmt.where(TelemetryRecord.locomotive_id == locomotive_id)
    result = await session.execute(stmt)
    return list(result.scalars().all())


def _fmt(v: float, decimals: int = 2) -> str:
    return f"{v:.{decimals}f}"


def _summary_rows(records: list[TelemetryRecord]) -> list[list[str]]:
    """min / avg / max по основным числовым полям."""
    fields = [
        ("Скорость (км/ч)", "speed_actual"),
        ("Тяга (кН)", "traction_force_kn"),
        ("Давл. ТМ (атм)", "tm_pressure"),
        ("Давл. ГР (атм)", "gr_pressure"),
        ("Давл. ТЦ (атм)", "tc_pressure"),
        ("Подшипники (°C)", "bearings_max"),
        ("Кабина (°C)", "cabin_temp"),
        ("Борт. напр. (В)", "board_voltage"),
        ("Health Index", "health_score"),
    ]
    header = ["Показатель", "Min", "Avg", "Max"]
    rows: list[list[str]] = [header]
    for label, attr in fields:
        vals = [float(getattr(r, attr)) for r in records]
        if not vals:
            rows.append([label, "—", "—", "—"])
            continue
        rows.append([
            label,
            _fmt(min(vals)),
            _fmt(statistics.mean(vals)),
            _fmt(max(vals)),
        ])
    return rows


def _detail_rows(records: list[TelemetryRecord], max_rows: int = 200) -> list[list[str]]:
    header = [
        "Время (UTC)", "Лок.", "Скор.", "Тяга",
        "ТМ", "ГР", "ТЦ", "Подш.",
        "Борт.В", "HP", "Статус",
    ]
    rows: list[list[str]] = [header]
    for r in records[-max_rows:]:
        rows.append([
            r.timestamp.strftime("%H:%M:%S"),
            r.locomotive_id,
            _fmt(r.speed_actual, 1),
            _fmt(r.traction_force_kn, 1),
            _fmt(r.tm_pressure, 2),
            _fmt(r.gr_pressure, 2),
            _fmt(r.tc_pressure, 2),
            _fmt(r.bearings_max, 1),
            _fmt(r.board_voltage, 1),
            str(r.health_score),
            r.health_status,
        ])
    return rows


def _make_table(data: list[list[str]], col_widths: list[float] | None = None) -> Table:
    _register_fonts()
    font = _FONT_NAME if _FONT_REGISTERED else "Helvetica"
    font_bold = f"{_FONT_NAME}-Bold" if _FONT_REGISTERED else "Helvetica-Bold"
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), font_bold),
        ("FONTNAME", (0, 1), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])
    t.setStyle(style)
    return t


def generate_pdf(
    records: list[TelemetryRecord],
    minutes: int = 15,
    locomotive_id: str | None = None,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    styles = _cyrillic_styles()
    elements: list = []

    now_utc = datetime.now(timezone.utc)
    since_utc = now_utc - timedelta(minutes=minutes)
    loco_label = locomotive_id or "все локомотивы"

    elements.append(Paragraph(
        f"Отчёт телеметрии — {loco_label}",
        styles["Title"],
    ))
    elements.append(Paragraph(
        f"Период: {since_utc:%Y-%m-%d %H:%M:%S} — {now_utc:%Y-%m-%d %H:%M:%S} UTC "
        f"({minutes} мин) &nbsp;|&nbsp; Записей: {len(records)}",
        styles["Normal"],
    ))
    elements.append(Spacer(1, 8 * mm))

    if not records:
        elements.append(Paragraph("Нет данных за указанный период.", styles["Normal"]))
    else:
        elements.append(Paragraph("Сводка (min / avg / max)", styles["Heading2"]))
        elements.append(Spacer(1, 2 * mm))
        elements.append(_make_table(_summary_rows(records)))
        elements.append(Spacer(1, 8 * mm))

        elements.append(Paragraph("Детальные записи", styles["Heading2"]))
        elements.append(Spacer(1, 2 * mm))
        elements.append(_make_table(_detail_rows(records)))

    doc.build(elements)
    return buf.getvalue()
